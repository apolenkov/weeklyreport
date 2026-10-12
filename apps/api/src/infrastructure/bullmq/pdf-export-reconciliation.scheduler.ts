import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PDF_EXPORT_QUEUE_NAME } from "@weeklyreport/shared";
import type { Job } from "bullmq";

import {
  type PdfExportJobIdentity,
  type PdfExportPendingCandidate,
  PdfExportService,
  type PdfExportTerminalState,
} from "../../modules/pdf-export/index.js";
import { QueueRegistry } from "./queue-registry.js";

const RECONCILIATION_LIMIT = 1000;

// The service owns the orphan scan's keyset paging, locked recheck, and
// quarantine write; the scheduler contributes only the live queue probe.
// A probe rejection is an unknown queue outcome, never proof of absence.
interface PdfExportOrphanScan {
  readonly scanOrphanedPendingExports: (
    hasQueueJob: (
      candidate: Pick<PdfExportPendingCandidate, "jobId" | "generation">,
    ) => Promise<boolean>,
  ) => Promise<unknown>;
}

/** Repairs DB rows stranded by a worker/process failure after BullMQ committed a terminal state. */
@Injectable()
export class PdfExportReconciliationScheduler {
  private readonly logger = new Logger(PdfExportReconciliationScheduler.name);

  constructor(
    @Inject(PdfExportService)
    private readonly service: Pick<PdfExportService, "reconcileTerminalState"> &
      PdfExportOrphanScan,
    @Inject(QueueRegistry) private readonly queues: Pick<QueueRegistry, "get">,
  ) {}

  onModuleInit(): void {
    void this.runOnce().catch((error: unknown) => {
      this.logger.error("pdf-export startup reconciliation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async reconcileTerminalJobs(): Promise<void> {
    await this.runOnce();
  }

  async runOnce(): Promise<void> {
    const queue = this.queues.get(PDF_EXPORT_QUEUE_NAME);
    const jobs = await queue.getJobs(
      ["completed", "failed"],
      0,
      RECONCILIATION_LIMIT - 1,
    );
    const repaired = (
      await Promise.all(jobs.map((job) => this.reconcileOne(job)))
    ).filter(Boolean).length;
    if (jobs.length > 0) {
      this.logger.log("pdf-export terminal reconciliation complete", {
        inspected: jobs.length,
        repaired,
      });
    }
    await this.service.scanOrphanedPendingExports((candidate) =>
      this.hasQueueJob(candidate),
    );
  }

  private async hasQueueJob(
    candidate: Pick<PdfExportPendingCandidate, "jobId" | "generation">,
  ): Promise<boolean> {
    const queue = this.queues.get(PDF_EXPORT_QUEUE_NAME);
    return (
      (await queue.getJob(`${candidate.jobId}-g${candidate.generation}`)) !==
      undefined
    );
  }

  private async reconcileOne(job: Job<unknown>): Promise<boolean> {
    try {
      const identity = terminalIdentity(job, asRecord(job.data));
      if (!identity) return false;
      return await this.service.reconcileTerminalState(identity, () =>
        this.loadCurrentTerminalState(identity),
      );
    } catch (error: unknown) {
      const jobData = asRecord(job.data);
      const payloadJobId =
        typeof jobData?.jobId === "string" ? jobData.jobId : undefined;
      this.logger.error("pdf-export terminal reconciliation failed", {
        jobId: payloadJobId ?? job.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  // Runs inside the export row lock: the listing's captured state is already
  // stale there, so the job is re-read — a retried job reports its live
  // state, not the old terminal one. The state is observed first, then the
  // job is re-read again: BullMQ transitions are not serialized by the row
  // lock, so the first snapshot's payload, failedReason, or returnvalue can
  // already belong to an older attempt.
  private async loadCurrentTerminalState(
    identity: PdfExportJobIdentity,
  ): Promise<PdfExportTerminalState | null> {
    const queue = this.queues.get(PDF_EXPORT_QUEUE_NAME);
    const queueJobId = `${identity.jobId}-g${identity.generation}`;
    const observed = await queue.getJob(queueJobId);
    if (!observed) return null;
    const observedState = await observed.getState();
    if (observedState !== "completed" && observedState !== "failed") {
      return null;
    }
    const current = await queue.getJob(queueJobId);
    if (!current) return null;
    return toTerminalState(current, await current.getState());
  }
}

function toTerminalState(
  job: Job<unknown>,
  queueState: Awaited<ReturnType<Job["getState"]>>,
): PdfExportTerminalState | null {
  if (queueState !== "completed" && queueState !== "failed") return null;
  const jobData = asRecord(job.data);
  const identity = terminalIdentity(job, jobData);
  if (!identity) return null;
  if (queueState === "failed") {
    return {
      ...identity,
      status: "failed",
      ...(job.failedReason ? { error: job.failedReason } : {}),
    };
  }
  return completedState(job, identity);
}

function terminalIdentity(
  job: Job<unknown>,
  data: ReturnType<typeof asRecord>,
): PdfExportJobIdentity | null {
  const jobId = typeof data?.jobId === "string" ? data.jobId : "";
  const reportId = typeof data?.reportId === "string" ? data.reportId : "";
  const requestedBy =
    typeof data?.requestedBy === "string" ? data.requestedBy : "";
  const generation = data?.generation;
  if (
    !jobId ||
    !reportId ||
    !requestedBy ||
    typeof generation !== "number" ||
    !Number.isInteger(generation) ||
    generation < 1
  ) {
    return null;
  }
  return job.id === `${jobId}-g${generation}`
    ? { jobId, reportId, requestedBy, generation }
    : null;
}

function completedState(
  job: Job<unknown>,
  identity: PdfExportJobIdentity,
): PdfExportTerminalState {
  const result: unknown = job.returnvalue as unknown;
  if (typeof result !== "object" || result === null) {
    return { ...identity, status: "completed" };
  }
  const value = result as { artifactUrl?: unknown; checksum?: unknown };
  return {
    ...identity,
    status: "completed",
    ...(typeof value.artifactUrl === "string"
      ? { artifactUrl: value.artifactUrl }
      : {}),
    ...(typeof value.checksum === "string" ? { checksum: value.checksum } : {}),
  };
}

function asRecord(value: unknown): {
  jobId?: unknown;
  reportId?: unknown;
  requestedBy?: unknown;
  generation?: unknown;
} | null {
  return typeof value === "object" && value !== null ? value : null;
}
