import type { FailedJobList } from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../lib/logger";
import type { AdminJobsQueue } from "./admin-jobs.port.js";

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

interface JobsServiceOptions {
  reminderExecutionExists?: (executionId: string) => Promise<boolean>;
}

// Absent queue (test wiring) → empty list / no-op retry so procedures never throw.
export class JobsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly emailReminderQueue: AdminJobsQueue | undefined,
    logger?: AppLogger,
    private readonly options: JobsServiceOptions = {},
  ) {
    this.logger = logger ?? createNullLogger();
  }

  async listFailed(input: {
    queue: "email-reminder";
    cursor?: number;
    limit?: number;
  }): Promise<ListFailedResult> {
    if (!this.emailReminderQueue) {
      return { jobs: [], nextCursor: null };
    }
    const limit = Math.min(
      Math.max(input.limit ?? DEFAULT_FAILED_JOBS_LIMIT, 1),
      MAX_FAILED_JOBS_LIMIT,
    );
    const start = Math.max(input.cursor ?? 0, 0);
    // BullMQ getFailed is inclusive on both ends: getFailed(0, 49) → 50 items.
    const end = start + limit - 1;

    const rawJobs = await this.emailReminderQueue.getFailed(start, end);

    const jobs = rawJobs.map((job) => job.failedJob);

    const nextCursor = jobs.length < limit ? null : start + limit;

    return { jobs, nextCursor };
  }

  async retryFailed(input: {
    queue: "email-reminder";
    jobId: string;
  }): Promise<RetryFailedResult> {
    if (!this.emailReminderQueue) {
      return { retried: false, jobId: input.jobId };
    }

    const job = await this.emailReminderQueue.getJob(input.jobId);
    if (!job) {
      // Pruned by removeOnFail or a parallel retry — structured no-op, not 500.
      return { retried: false, jobId: input.jobId };
    }

    const executionId = job.reminderExecutionId;
    if (executionId && this.options.reminderExecutionExists) {
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

    await job.retry();
    this.logger.info("admin.jobs.retry — job requeued", {
      phase: "admin.jobs.retry",
      queue: input.queue,
      jobId: input.jobId,
    });
    return { retried: true, jobId: input.jobId };
  }
}
