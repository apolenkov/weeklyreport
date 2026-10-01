import {
  EMAIL_REMINDER_QUEUE_NAME,
  type FailedJobList,
  PDF_EXPORT_QUEUE_NAME,
  type PdfRecoveryJob,
  type PdfRecoveryJobList,
  type PdfRecoveryRetryInput,
  type PdfRecoveryRetryResult,
  type QueueName,
} from "@customreport/shared";

import type { AppLogger } from "../../lib/logger";
import type {
  AdminJobDomainReference,
  AdminJobHandle,
  AdminJobsQueue,
  AdminJobsQueueRegistry,
  AdminPdfExportRetryOutcome,
} from "./admin-jobs.port.js";

const DEFAULT_FAILED_JOBS_LIMIT = 50;
const MAX_FAILED_JOBS_LIMIT = 200;
const ADMIN_JOBS_RETRY_PHASE = "admin.jobs.retry";
// No mutation audit here: mutationAuditMiddleware captures tRPC mutations.

export type ListFailedResult = FailedJobList;

export interface RetryFailedResult {
  retried: boolean;
  jobId: string;
  removed?: boolean;
  reason?: string;
}

export interface RemoveFailedResult {
  removed: boolean;
  jobId: string;
}

interface JobsServiceOptions {
  reminderExecutionExists: (executionId: string) => Promise<boolean>;
  // Revives a terminal-failed execution so the worker's pending-only claim CAS
  // can pick it up again; absent means the caller opted out of revival.
  reviveFailedReminderExecution?: (executionId: string) => Promise<void>;
  // Generation-bound pdf-export retry: the durable row decides whether the
  // caller-selected generation may advance; the queue job is never retried
  // in place — a fresh `${jobId}-g${generation + 1}` entry is enqueued.
  // Required — a bare queue retry would strand the terminal-failed export row.
  retryPdfExportGeneration: (input: {
    jobId: string;
    expectedGeneration: number;
  }) => Promise<AdminPdfExportRetryOutcome>;
  // Durable list of export rows quarantined as recovery_required. Their
  // generation's queue job may already be gone, so Redis is never consulted.
  listPdfRecoveryJobs: () => Promise<readonly PdfRecoveryJob[]>;
}

function assertQueueMatch(expected: QueueName, actual: QueueName): void {
  if (actual !== expected) {
    throw new Error(
      `Queue adapter mismatch: requested ${expected}, received ${actual}.`,
    );
  }
}

export interface FailedCounts {
  readonly count: number;
  readonly byQueue: readonly {
    readonly queue: QueueName;
    readonly count: number;
  }[];
}

export class JobsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly queues: AdminJobsQueueRegistry,
    private readonly options: JobsServiceOptions,
    logger: AppLogger,
  ) {
    this.logger = logger;
  }

  private queue(name: QueueName): AdminJobsQueue {
    return this.queues.get(name);
  }

  // The per-queue split lets the Jobs tab open on a queue that has failures.
  async countFailed(): Promise<FailedCounts> {
    const byQueue = await Promise.all(
      this.queues.names.map(async (queue) => ({
        queue,
        count: await this.queues.get(queue).getFailedCount(),
      })),
    );
    return {
      count: byQueue.reduce((total, entry) => total + entry.count, 0),
      byQueue,
    };
  }

  async listFailed(input: {
    queue: QueueName;
    cursor?: number;
    limit?: number;
  }): Promise<ListFailedResult> {
    const queue = this.queue(input.queue);
    const limit = Math.min(
      Math.max(input.limit ?? DEFAULT_FAILED_JOBS_LIMIT, 1),
      MAX_FAILED_JOBS_LIMIT,
    );
    const start = Math.max(input.cursor ?? 0, 0);
    // BullMQ getFailed is inclusive on both ends: getFailed(0, 49) → 50 items.
    const end = start + limit - 1;

    const rawJobs = await queue.getFailed(start, end);

    const jobs = rawJobs.map((job) => {
      assertQueueMatch(input.queue, job.domainReference.queue);
      return job.failedJob;
    });

    const nextCursor = jobs.length < limit ? null : start + limit;

    return { jobs, nextCursor };
  }

  async retryFailed(input: {
    queue: QueueName;
    jobId: string;
  }): Promise<RetryFailedResult> {
    const queue = this.queue(input.queue);
    const job = await queue.getJob(input.jobId);
    if (!job) {
      // Pruned by removeOnFail or a parallel retry — structured no-op, not 500.
      return { retried: false, jobId: input.jobId };
    }

    const reference = job.domainReference;
    assertQueueMatch(input.queue, reference.queue);
    if (
      input.queue === PDF_EXPORT_QUEUE_NAME &&
      reference.queue === PDF_EXPORT_QUEUE_NAME
    ) {
      return this.retryPdfExportEntry(input.jobId, job, reference);
    }

    // A stale UI request can point at live work — only failed jobs may be
    // retried. Runs before every reminder-domain side effect; pdf-export
    // arbitrates eligibility on the durable row inside its generation seam.
    const state = await job.getState();
    if (state !== "failed") {
      this.logger.info("admin.jobs.retry — job is not failed", {
        phase: ADMIN_JOBS_RETRY_PHASE,
        queue: input.queue,
        jobId: input.jobId,
        state,
      });
      return {
        retried: false,
        jobId: input.jobId,
        reason: `Job is not failed (current state: ${state}).`,
      };
    }

    if (
      input.queue === EMAIL_REMINDER_QUEUE_NAME &&
      reference.queue === EMAIL_REMINDER_QUEUE_NAME &&
      reference.reminderExecutionId
    ) {
      const executionId = reference.reminderExecutionId;
      const exists = await this.options.reminderExecutionExists(executionId);
      if (!exists) {
        await job.remove();
        const reason = `Reminder execution ${executionId} no longer exists.`;
        this.logger.info("admin.jobs.retry — stale job removed", {
          phase: ADMIN_JOBS_RETRY_PHASE,
          queue: input.queue,
          jobId: input.jobId,
          executionId,
        });
        return {
          retried: false,
          removed: true,
          reason,
          jobId: input.jobId,
        };
      }
      // A terminal-failed row would otherwise be rejected by the worker's
      // pending-only claim CAS, making the retry a silent no-op. Revive it.
      await this.options.reviveFailedReminderExecution?.(executionId);
    }

    // A retry only requeues the domain reference. The owning worker claims
    // the durable row and renders its current payload, never this job's body.
    await job.retry();
    this.logger.info("admin.jobs.retry — job requeued", {
      phase: ADMIN_JOBS_RETRY_PHASE,
      queue: input.queue,
      jobId: input.jobId,
    });
    return { retried: true, jobId: input.jobId };
  }

  // The pdf-export module owns the transition: `retryExportGeneration`
  // advances the durable row exactly one generation under its row lock and
  // enqueues a fresh generation-scoped queue job. This side only binds the
  // retained queue entry to the generation the caller selected and maps the
  // outcome — no queue-state read or in-place retry happens here.
  private async retryPdfExportEntry(
    jobId: string,
    job: AdminJobHandle,
    reference: Extract<
      AdminJobDomainReference,
      { queue: typeof PDF_EXPORT_QUEUE_NAME }
    >,
  ): Promise<RetryFailedResult> {
    const identity = reference.pdfExportIdentity;
    if (
      !identity ||
      job.failedJob.id !== `${identity.jobId}-g${identity.generation}`
    ) {
      this.logger.error(
        "admin.jobs.retry — pdf-export payload identity rejected",
        {
          phase: ADMIN_JOBS_RETRY_PHASE,
          queue: PDF_EXPORT_QUEUE_NAME,
          jobId,
        },
      );
      return {
        retried: false,
        jobId,
        reason: "PDF export payload identity is missing or mismatched.",
      };
    }

    const outcome = await this.options.retryPdfExportGeneration({
      jobId: identity.jobId,
      expectedGeneration: identity.generation,
    });
    // already-advanced is an idempotent repeat of the same caller-selected
    // generation — the requested end state already holds, so report success.
    if (outcome === "retried" || outcome === "already-advanced") {
      // The fresh `-g${generation + 1}` job supersedes this failed entry;
      // dropping it keeps the DLQ count and badge truthful. The durable row
      // still drives recovery if the new generation fails in turn.
      // Best effort: the durable advance already succeeded.
      await job.remove().catch((error: unknown) => {
        this.logger.warn("admin.jobs.retry — superseded entry not removed", {
          phase: ADMIN_JOBS_RETRY_PHASE,
          queue: PDF_EXPORT_QUEUE_NAME,
          jobId,
          error: String(error),
        });
      });
      this.logger.info("admin.jobs.retry — job requeued", {
        phase: ADMIN_JOBS_RETRY_PHASE,
        queue: PDF_EXPORT_QUEUE_NAME,
        jobId,
        outcome,
      });
      return { retried: true, jobId };
    }
    this.logger.info("admin.jobs.retry — pdf-export retry declined", {
      phase: ADMIN_JOBS_RETRY_PHASE,
      queue: PDF_EXPORT_QUEUE_NAME,
      jobId,
      outcome,
    });
    return {
      retried: false,
      jobId,
      reason:
        "PDF export row is missing, not failed, or bound to another payload.",
    };
  }

  async listPdfRecovery(): Promise<PdfRecoveryJobList> {
    return { jobs: await this.options.listPdfRecoveryJobs() };
  }

  async retryPdfRecovery(
    input: PdfRecoveryRetryInput,
  ): Promise<PdfRecoveryRetryResult> {
    const outcome = await this.options.retryPdfExportGeneration(input);
    return { jobId: input.jobId, outcome };
  }

  async removeFailed(input: {
    queue: QueueName;
    jobId: string;
  }): Promise<RemoveFailedResult> {
    const queue = this.queue(input.queue);
    const job = await queue.getJob(input.jobId);
    if (!job) return { removed: false, jobId: input.jobId };
    assertQueueMatch(input.queue, job.domainReference.queue);
    const state = await job.getState();
    if (state !== "failed") {
      this.logger.info("admin.jobs.remove — job is not failed", {
        phase: "admin.jobs.remove",
        queue: input.queue,
        jobId: input.jobId,
        state,
      });
      return { removed: false, jobId: input.jobId };
    }
    await job.remove();
    this.logger.info("admin.jobs.remove — job removed", {
      phase: "admin.jobs.remove",
      queue: input.queue,
      jobId: input.jobId,
    });
    return { removed: true, jobId: input.jobId };
  }
}
