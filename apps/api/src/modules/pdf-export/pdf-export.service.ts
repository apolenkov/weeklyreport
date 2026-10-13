import { Inject, Injectable } from "@nestjs/common";
import {
  AUTH_COOKIE_NAME,
  type PdfExportJob,
  pdfExportJobSchema,
  type UserSession,
} from "@weeklyreport/shared";

import { ENV_CONFIG } from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import { requireEnv } from "../../lib/env.js";
import { errorMessage } from "../../lib/error-message.js";
import { type AppLogger } from "../../lib/logger";
import { buildPublishedReadModelFromSnapshot } from "../weekly-report/index.js";
import { PdfExportDomainError } from "./pdf-export.job-state.js";
import {
  PDF_EXPORT_ENQUEUER,
  PDF_EXPORT_TELEMETRY,
  type PdfExportEnqueuer,
  type PdfExportJobIdentity,
  type PdfExportRepository,
  type PdfExportRetryOutcome,
  type PdfExportTelemetry,
  type PdfExportTerminalState,
  type PdfRenderCookie,
} from "./pdf-export.ports.js";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository.js";
import {
  dispatchExportGeneration as dispatchExportGenerationPure,
  type PdfExportOrphanScanSummary,
  type PdfExportQueueJobProbe,
  type PdfExportRecoveryDeps,
  type PdfExportRetryInput,
  reconcileTerminalState as reconcileTerminalStatePure,
  retryExportGeneration as retryExportGenerationPure,
  scanOrphanedPendingExports as scanOrphanedPendingExportsPure,
} from "./pdf-export.recovery.js";
import { signPdfExportToken as signPdfExportTokenPure } from "./pdf-export.token.js";

// Template id stamped on every created export job; read paths round-trip the
// persisted value rather than relabel with the running constant.
const PDF_EXPORT_TEMPLATE_VERSION = "phase-2-pdf-v1";

// A fresh export is always dispatched as generation 1; only the Head retry
// transition advances it.
const PDF_EXPORT_INITIAL_GENERATION = 1;

// Telemetry role label for non-tRPC callers (workers/cron) with no session role.
const SYSTEM_ROLE_LABEL = "system";

export type { PdfExportOrphanScanSummary, PdfExportRetryInput };

@Injectable()
export class PdfExportService {
  private readonly logger: AppLogger;
  private readonly recoveryDeps: PdfExportRecoveryDeps;

  constructor(
    @Inject(PdfExportPrismaRepository)
    private readonly repository: PdfExportRepository,
    @Inject(APP_LOGGER) logger: AppLogger,
    @Inject(PDF_EXPORT_ENQUEUER) pdfQueue: PdfExportEnqueuer,
    @Inject(PDF_EXPORT_TELEMETRY)
    private readonly telemetry: PdfExportTelemetry,
    @Inject(ENV_CONFIG)
    private readonly env: Pick<
      EnvConfig,
      "PDF_BASE_URL" | "PDF_EXPORT_JWT_SECRET"
    >,
  ) {
    this.logger = logger;
    this.recoveryDeps = { repository, pdfQueue, telemetry, logger };
  }

  // Throws PdfExportDomainError (tRPC → 500) if the secret is missing/too short —
  // fail loud at request time rather than mint an unverifiable token.
  signPdfExportToken(
    reportId: string,
    jobId: string,
    requestedBy: string,
  ): string {
    try {
      return signPdfExportTokenPure(
        reportId,
        jobId,
        requestedBy,
        this.env.PDF_EXPORT_JWT_SECRET,
      );
    } catch (error) {
      throw new PdfExportDomainError(
        error instanceof Error
          ? error.message
          : "PDF_EXPORT_JWT_SECRET is missing or too short (must be >= 32 chars).",
      );
    }
  }

  async requestPdfExport(
    reportId: string,
    session: UserSession,
    // Role label for weeklyreport_pdf_export_requests_total; worker/cron default to 'system'.
    requestedByRole?: string,
  ): Promise<PdfExportJob> {
    const report = await this.repository.getPublishedReportForExport(
      reportId,
      session,
    );

    if (!report) {
      throw new PdfExportDomainError(
        "PDF export is not available for this caller.",
      );
    }
    if (report.status !== "published") {
      throw new PdfExportDomainError("PDF export requires a published report.");
    }

    this.logger.info("requesting PDF export", {
      reportId,
      requestedBy: session.userId,
    });
    const job = await this.repository.createExportJob(
      pdfExportJobSchema.parse({
        jobId: crypto.randomUUID(),
        reportId,
        status: "queued",
        generation: PDF_EXPORT_INITIAL_GENERATION,
        requestedAt: new Date(),
        completedAt: null,
        checksum: null,
        templateVersion: PDF_EXPORT_TEMPLATE_VERSION,
        artifactUrl: null,
      }),
      session.userId,
      report,
    );

    // The durable job carries only non-credential identifiers; the worker
    // mints a fresh short-lived token from them at execution time, so a
    // persisted payload never holds a bearer credential.
    try {
      const dispatched = await dispatchExportGenerationPure(this.recoveryDeps, {
        reportId,
        jobId: job.jobId,
        generation: job.generation,
        requestedBy: session.userId,
      });
      if (!dispatched) {
        // The locked re-verification observed a row that is no longer pending
        // at this generation (a concurrent quarantine committed first). Abort
        // the dispatch: no add, and no compensating write — the committed row
        // belongs to the recovery surface now.
        this.logger.error(
          "pdf-export initial dispatch aborted: row is not pending at its generation",
          { jobId: job.jobId, reportId },
        );
        return job;
      }
    } catch (error) {
      // Try to mark this generation failed so status/reaper surfaces the
      // breakage. Persistence can fail; keep the dispatch error primary.
      // A Redis command already issued with unknown outcome cannot be
      // cancelled on lock release; the worker's
      // pending+generation fence contains a job that executes late.
      try {
        await this.markExportFailed(
          job.jobId,
          job.generation,
          error instanceof Error ? error.message : String(error),
        );
      } catch (compensationError) {
        this.logger.error("PDF export failure compensation failed", {
          jobId: job.jobId,
          reportId,
          generation: job.generation,
          error: errorMessage(compensationError),
        });
      }
      throw error;
    }
    this.logger.info("enqueued pdf-export job", {
      jobId: job.jobId,
      reportId,
    });

    this.telemetry.recordRequest(requestedByRole ?? SYSTEM_ROLE_LABEL);

    return job;
  }

  async getPdfExportRender(
    jobId: string,
    requestedBy: string,
    reportId: string,
  ): Promise<ReturnType<typeof buildPublishedReadModelFromSnapshot>> {
    const job = await this.repository.getExportJob(jobId);
    if (job?.requestedBy !== requestedBy || job.reportId !== reportId) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }
    const snapshot = await this.repository.getPublishedReportForJob(jobId);
    if (!snapshot) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }
    return buildPublishedReadModelFromSnapshot(snapshot, {
      periodState: "published",
      periodStatus: "published",
      archived: false,
      weekLabel: null,
    });
  }

  async getPdfExportStatus(
    jobId: string,
    requestedBy: string,
  ): Promise<PdfExportJob> {
    const job = await this.repository.getExportJob(jobId);

    if (job?.requestedBy !== requestedBy) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }

    return pdfExportJobSchema.parse(job);
  }

  /**
   * Pre-render gate: validates the queue payload against the immutable
   * persisted job identity and requires the row to still be pending at
   * exactly the payload's generation. A stale-generation or terminal row
   * rejects — the worker performs no render and no write.
   */
  async assertPdfExportJobIdentity(
    jobId: string,
    reportId: string,
    requestedBy: string,
    generation: number,
  ): Promise<void> {
    const job = await this.repository.getExportJob(jobId);
    if (
      job?.reportId !== reportId ||
      job.requestedBy !== requestedBy ||
      job.status !== "queued" ||
      job.generation !== generation
    ) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }
  }

  /**
   * The Head retry transition. Phase A commits `pending(g+1)` under the row
   * lock — only from `failed`/`recovery_required` at exactly the caller-bound
   * `expectedGeneration`, which is never re-derived from the row — then phase
   * B re-verifies `pending(g+1)` under a fresh lock and issues the
   * generation-scoped queue add inside it. An enqueue throw or lost ack
   * leaves the committed `pending(g+1)` for the orphan scan or a later retry;
   * it is never compensated or marked failed.
   */
  async retryExportGeneration(
    input: PdfExportRetryInput,
  ): Promise<PdfExportRetryOutcome> {
    return retryExportGenerationPure(this.recoveryDeps, input);
  }

  /**
   * One finite pass over aged `pending` rows: pages the immutable
   * `(createdAt, id)` keyset bounded at pass start, and per candidate holds
   * the row lock to re-verify pending+generation+age before probing the
   * generation-scoped queue job. Only a confirmed-absent job quarantines the
   * row to `recovery_required`; a probe error or unknown outcome skips the
   * row untouched — it is never treated as absence.
   */
  async scanOrphanedPendingExports(
    hasQueueJob: PdfExportQueueJobProbe,
  ): Promise<PdfExportOrphanScanSummary> {
    return scanOrphanedPendingExportsPure(this.recoveryDeps, hasQueueJob);
  }

  async markExportCompleted(
    jobId: string,
    generation: number,
    artifactUrl: string,
    checksum: string,
  ): Promise<PdfExportJob> {
    const job = await this.repository.getExportJob(jobId);
    if (!job) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }

    this.logger.info("marking PDF export completed", { jobId, generation });
    return this.repository.saveExportJob(
      pdfExportJobSchema.parse({
        ...job,
        // The claimed generation — never the row's current one — is what the
        // pending+generation CAS fences on.
        generation,
        status: "completed",
        completedAt: new Date(),
        artifactUrl,
        checksum,
      }),
    );
  }

  async markExportFailed(
    jobId: string,
    generation: number,
    error: string,
  ): Promise<void> {
    this.logger.error("PDF export job failed", { jobId, generation, error });
    await this.repository.markExportFailed(jobId, generation, error);
  }

  /**
   * Reconciles a terminal queue state to the durable export row under the
   * per-export row lock. `loadCurrentTerminalState` re-reads the queue AFTER
   * the lock is held, so a state captured before it (for example a failure
   * whose job has since been retried) can never overwrite a newer attempt.
   */
  async reconcileTerminalState(
    identity: PdfExportJobIdentity,
    loadCurrentTerminalState: () => Promise<PdfExportTerminalState | null>,
  ): Promise<boolean> {
    return reconcileTerminalStatePure(
      this.recoveryDeps,
      identity,
      loadCurrentTerminalState,
    );
  }

  // Scope the render credential to the print origin used by Gotenberg.
  buildAuthCookies(authToken: string): PdfRenderCookie[] {
    const baseUrl = requireEnv(this.env, "PDF_BASE_URL");

    return [
      {
        name: AUTH_COOKIE_NAME,
        value: authToken,
        domain: new URL(baseUrl).hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ];
  }
}
