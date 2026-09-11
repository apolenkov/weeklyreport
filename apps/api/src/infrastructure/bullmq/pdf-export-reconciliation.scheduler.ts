import { PDF_EXPORT_QUEUE_NAME } from "@customreport/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Job } from "bullmq";

import {
  PdfExportService,
  type PdfExportTerminalState,
} from "../../modules/pdf-export/index.js";
import { QueueRegistry } from "./queue-registry.js";

const RECONCILIATION_LIMIT = 1000;

/** Repairs DB rows stranded by a worker/process failure after BullMQ committed a terminal state. */
@Injectable()
export class PdfExportReconciliationScheduler {
  private readonly logger = new Logger(PdfExportReconciliationScheduler.name);

  constructor(
    @Inject(PdfExportService)
    private readonly service: Pick<PdfExportService, "reconcileTerminalState">,
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
  }

  private async reconcileOne(job: Job<unknown>): Promise<boolean> {
    try {
      const state = toTerminalState(job, await job.getState());
      if (!state) return false;
      return await this.service.reconcileTerminalState(state);
    } catch (error: unknown) {
      const jobData = asRecord(job.data);
      const payloadJobId =
        typeof jobData?.jobId === "string" ? jobData.jobId : undefined;
      this.logger.error("pdf-export terminal reconciliation failed", {
        jobId: job.id ?? payloadJobId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
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
): { jobId: string; reportId: string; requestedBy: string } | null {
  const jobId = typeof data?.jobId === "string" ? data.jobId : "";
  const reportId = typeof data?.reportId === "string" ? data.reportId : "";
  const requestedBy =
    typeof data?.requestedBy === "string" ? data.requestedBy : "";
  if (!jobId || !reportId || !requestedBy) return null;
  return job.id === undefined || job.id === jobId
    ? { jobId, reportId, requestedBy }
    : null;
}

function completedState(
  job: Job<unknown>,
  identity: { jobId: string; reportId: string; requestedBy: string },
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
} | null {
  return typeof value === "object" && value !== null ? value : null;
}
