import type { AppLogger } from "../../lib/logger";
import {
  type PdfExportEnqueueInput,
  type PdfExportEnqueuer,
  type PdfExportJobIdentity,
  type PdfExportPendingCandidate,
  type PdfExportPendingCursor,
  type PdfExportRepository,
  type PdfExportRetryOutcome,
  type PdfExportTelemetry,
  type PdfExportTerminalState,
} from "./pdf-export.ports.js";

// Orphan-scan tuning (the RECONCILIATION_LIMIT / PAGE_GOTO_TIMEOUT_MS
// precedent — module constants, not product config): 15 minutes is safely
// beyond the 3-attempt × ~60 s render budget.
const PDF_EXPORT_ORPHAN_MIN_AGE_MS = 900_000;
const ORPHAN_SCAN_PAGE_SIZE = 100;

export interface PdfExportOrphanScanSummary {
  readonly inspected: number;
  readonly quarantined: number;
  readonly failed: number;
}

export interface PdfExportRecoveryDeps {
  readonly repository: PdfExportRepository;
  readonly pdfQueue: PdfExportEnqueuer;
  readonly telemetry: PdfExportTelemetry;
  readonly logger: AppLogger;
}

export type PdfExportQueueJobProbe = (
  candidate: Pick<PdfExportPendingCandidate, "jobId" | "generation">,
) => Promise<boolean>;

export interface PdfExportRetryInput {
  readonly jobId: string;
  readonly expectedGeneration: number;
}

/**
 * The dispatch leg shared with the retry transition's phase B: under the
 * export row lock, re-verify the row is still pending at the generation
 * being dispatched, then issue the queue add while the lock is held. The
 * lock is what serializes dispatch against quarantine — a committed
 * quarantine fails the verification and no add happens, while a committed
 * add is what the quarantine probe observes. This leg writes nothing: a
 * rejected verification or a thrown enqueue leaves the committed row
 * untouched.
 */
export const dispatchExportGeneration = async (
  deps: PdfExportRecoveryDeps,
  input: PdfExportEnqueueInput,
): Promise<boolean> =>
  deps.repository.runLockedExportJob(input.jobId, async (job) => {
    if (job?.status !== "queued" || job.generation !== input.generation) {
      return false;
    }
    await deps.pdfQueue.enqueue(input, deps.telemetry.captureJobContext());
    return true;
  });

/**
 * The Head retry transition. Phase A commits `pending(g+1)` under the row
 * lock — only from `failed`/`recovery_required` at exactly the caller-bound
 * `expectedGeneration`, which is never re-derived from the row — then phase
 * B re-verifies `pending(g+1)` under a fresh lock and issues the
 * generation-scoped queue add inside it. An enqueue throw or lost ack
 * leaves the committed `pending(g+1)` for the orphan scan or a later retry;
 * it is never compensated or marked failed.
 */
export const retryExportGeneration = async (
  deps: PdfExportRecoveryDeps,
  input: PdfExportRetryInput,
): Promise<PdfExportRetryOutcome> => {
  const { jobId, expectedGeneration } = input;
  if (!Number.isInteger(expectedGeneration) || expectedGeneration < 1) {
    return "ineligible";
  }

  const transition = await deps.repository.runLockedExportJob(
    jobId,
    async (job, writes) => {
      if (
        (job?.status === "failed" || job?.status === "recovery_required") &&
        job.generation === expectedGeneration
      ) {
        await writes.advanceGeneration(expectedGeneration);
        return {
          outcome: "retried" as const,
          reportId: job.reportId,
          requestedBy: job.requestedBy,
        };
      }
      return {
        outcome:
          job?.status === "queued" && job.generation === expectedGeneration + 1
            ? ("already-advanced" as const)
            : ("ineligible" as const),
      };
    },
  );
  if (transition.outcome !== "retried") {
    return transition.outcome;
  }

  // A quarantine that committed between the two phases fails the dispatch
  // leg's verification and skips the add; the generation was still advanced.
  const dispatched = await dispatchExportGeneration(deps, {
    jobId,
    reportId: transition.reportId,
    generation: expectedGeneration + 1,
    requestedBy: transition.requestedBy,
  });
  deps.logger.info(
    dispatched
      ? "pdf-export retry dispatched a new generation"
      : "pdf-export retry dispatch skipped: row left pending between phases",
    { jobId, generation: expectedGeneration + 1 },
  );
  return "retried";
};

/**
 * Reconciles a terminal queue state to the durable export row under the
 * per-export row lock. `loadCurrentTerminalState` re-reads the queue AFTER
 * the lock is held, so a state captured before it (for example a failure
 * whose job has since been retried) can never overwrite a newer attempt.
 */
export const reconcileTerminalState = async (
  deps: PdfExportRecoveryDeps,
  identity: PdfExportJobIdentity,
  loadCurrentTerminalState: () => Promise<PdfExportTerminalState | null>,
): Promise<boolean> =>
  deps.repository.runLockedExportJob(identity.jobId, async (job, writes) => {
    if (job?.status !== "queued") {
      return false;
    }
    const state = await loadCurrentTerminalState();
    if (state === null) {
      return false;
    }
    if (
      state.jobId !== identity.jobId ||
      state.reportId !== identity.reportId ||
      state.requestedBy !== identity.requestedBy ||
      state.generation !== identity.generation ||
      job.reportId !== identity.reportId ||
      job.requestedBy !== identity.requestedBy ||
      job.generation !== identity.generation
    ) {
      deps.logger.error("pdf-export terminal identity mismatch", {
        jobId: state.jobId,
        reportId: state.reportId,
        requestedBy: state.requestedBy,
      });
      return false;
    }
    if (state.status === "failed") {
      await writes.markFailed(
        identity.generation,
        state.error ?? "PDF export failed in BullMQ",
      );
      return true;
    }
    if (!state.artifactUrl || !state.checksum) {
      deps.logger.error(
        "pdf-export completed job has no durable artifact result",
        {
          jobId: state.jobId,
        },
      );
      return false;
    }
    await writes.markCompleted(
      identity.generation,
      state.artifactUrl,
      state.checksum,
    );
    return true;
  });

// Returns true only when the candidate was quarantined. A probe rejection
// propagates to the caller's skip-and-log path — it is never treated as
// absence.
const quarantineIfOrphaned = async (
  deps: PdfExportRecoveryDeps,
  candidate: PdfExportPendingCandidate,
  bound: Date,
  hasQueueJob: PdfExportQueueJobProbe,
): Promise<boolean> =>
  deps.repository.runLockedExportJob(candidate.jobId, async (job, writes) => {
    if (
      job?.status !== "queued" ||
      job.generation !== candidate.generation ||
      job.requestedAt > bound
    ) {
      return false;
    }
    // The probe runs under the lock so quarantine serializes with dispatch:
    // a committed add is observed here; a committed quarantine instead fails
    // the dispatcher's re-verification.
    if (await hasQueueJob({ jobId: job.jobId, generation: job.generation })) {
      return false;
    }
    await writes.markRecoveryRequired(job.generation);
    return true;
  });

// One candidate inside the pass: inspect-and-quarantine under the row lock,
// with a probe/lock failure counted and logged rather than treated as
// absence. The summary accumulator is the pass's single mutable state.
const inspectOrphanCandidate = async (
  deps: PdfExportRecoveryDeps,
  candidate: PdfExportPendingCandidate,
  pass: {
    readonly bound: Date;
    readonly hasQueueJob: PdfExportQueueJobProbe;
    readonly summary: { quarantined: number; failed: number };
  },
): Promise<void> => {
  const { bound, hasQueueJob, summary } = pass;
  try {
    if (await quarantineIfOrphaned(deps, candidate, bound, hasQueueJob)) {
      summary.quarantined += 1;
      deps.logger.info("pdf-export orphan quarantined for recovery", {
        jobId: candidate.jobId,
        generation: candidate.generation,
      });
    }
  } catch (error) {
    summary.failed += 1;
    deps.logger.error("pdf-export orphan scan skipped a candidate", {
      jobId: candidate.jobId,
      generation: candidate.generation,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * One finite pass over aged `pending` rows: pages the immutable
 * `(createdAt, id)` keyset bounded at pass start, and per candidate holds
 * the row lock to re-verify pending+generation+age before probing the
 * generation-scoped queue job. Only a confirmed-absent job quarantines the
 * row to `recovery_required`; a probe error or unknown outcome skips the
 * row untouched — it is never treated as absence.
 */
export const scanOrphanedPendingExports = async (
  deps: PdfExportRecoveryDeps,
  hasQueueJob: PdfExportQueueJobProbe,
): Promise<PdfExportOrphanScanSummary> => {
  // Fixed pass-start bound: rows created during the pass are never chased.
  const bound = new Date(Date.now() - PDF_EXPORT_ORPHAN_MIN_AGE_MS);
  // eslint-disable-next-line no-restricted-syntax -- the keyset cursor is load-bearing: it must advance once per inspected row across the pagination loop
  let cursor: PdfExportPendingCursor | null = null;
  const summary = { inspected: 0, quarantined: 0, failed: 0 };
  for (;;) {
    const page = await deps.repository.listPendingExportCandidates(
      bound,
      cursor,
      ORPHAN_SCAN_PAGE_SIZE,
    );
    if (page.length === 0) {
      break;
    }
    for (const candidate of page) {
      // Every inspected row advances the keyset — live queue jobs
      // included — so a dense run of live rows can never starve the pass.
      cursor = { createdAt: candidate.createdAt, jobId: candidate.jobId };
      summary.inspected += 1;
      await inspectOrphanCandidate(deps, candidate, {
        bound,
        hasQueueJob,
        summary,
      });
    }
    if (page.length < ORPHAN_SCAN_PAGE_SIZE) {
      break;
    }
  }
  return summary;
};
