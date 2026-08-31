import {
  EMAIL_REMINDER_QUEUE_NAME,
  type FailedJobList,
  type QueueName,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger";
import type {
  AdminJobsQueue,
  AdminJobsQueueRegistry,
} from "./admin-jobs.port.js";

const DEFAULT_FAILED_JOBS_LIMIT = 50;
const MAX_FAILED_JOBS_LIMIT = 200;
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
}

function assertQueueMatch(expected: QueueName, actual: QueueName): void {
  if (actual !== expected) {
    throw new Error(
      `Queue adapter mismatch: requested ${expected}, received ${actual}.`,
    );
  }
}

export class JobsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly queues: AdminJobsQueueRegistry,
    private readonly options: JobsServiceOptions,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  private queue(name: QueueName): AdminJobsQueue {
    return this.queues.get(name);
  }

  async countFailed(): Promise<number> {
    const counts = await Promise.all(
      this.queues.names.map((name) => this.queues.get(name).getFailedCount()),
    );
    return counts.reduce((total, count) => total + count, 0);
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
          phase: "admin.jobs.retry",
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
    }

    // A retry only requeues the domain reference. The owning worker claims
    // the durable row and renders its current payload, never this job's body.
    await job.retry();
    this.logger.info("admin.jobs.retry — job requeued", {
      phase: "admin.jobs.retry",
      queue: input.queue,
      jobId: input.jobId,
    });
    return { retried: true, jobId: input.jobId };
  }

  async removeFailed(input: {
    queue: QueueName;
    jobId: string;
  }): Promise<RemoveFailedResult> {
    const queue = this.queue(input.queue);
    const job = await queue.getJob(input.jobId);
    if (!job) return { removed: false, jobId: input.jobId };
    assertQueueMatch(input.queue, job.domainReference.queue);
    await job.remove();
    this.logger.info("admin.jobs.remove — job removed", {
      phase: "admin.jobs.remove",
      queue: input.queue,
      jobId: input.jobId,
    });
    return { removed: true, jobId: input.jobId };
  }
}
