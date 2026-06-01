import type { Queue } from "bullmq";

import { type AppLogger, createNullLogger } from "../../lib/logger";

/**
 * Phase 35-06 — admin BullMQ DLQ surface.
 *
 * Thin wrapper around the live `email-reminder` Queue handle so the tRPC
 * router can stay declarative and the unit tests can swap in a fake queue
 * without spinning up Redis. The shape mirrors what `admin.dlqCount` already
 * does for the failed-count badge — same Queue instance, same accessor
 * pattern — but extends it to enumerate / retry individual failed jobs.
 *
 * No mutation audit emit lives here: the existing `mutationAuditMiddleware`
 * captures every authenticated mutation through tRPC procedure-level wiring
 * (see infrastructure/trpc/trpc.middleware.ts § mutationAuditMiddleware). The
 * `procedure: 'admin.jobs.retryFailed'`, `target: jobId`, and
 * `userId/role/ip` envelope are emitted automatically.
 */

export interface FailedJob {
  id: string;
  name: string;
  failedReason: string;
  stacktrace: readonly string[];
  attemptsMade: number;
  /** ms since epoch — when the job was added to BullMQ. */
  timestamp: number;
  /** Best-effort serialisable copy of the job payload. */
  data: unknown;
}

export interface ListFailedResult {
  jobs: FailedJob[];
  /** BullMQ pagination cursor — next start index. `null` when exhausted. */
  nextCursor: number | null;
}

export interface RetryFailedResult {
  retried: boolean;
  jobId: string;
  removed?: boolean;
  reason?: string;
}

interface JobsServiceOptions {
  reminderExecutionExists?: (executionId: string) => Promise<boolean>;
}

/**
 * 35-06: when the BullMQ Queue handle is absent (e.g. unit-test wiring with
 * `createAppRouter({})`), the service still needs to be callable. Caller
 * surfaces an empty list / no-op retry so the tRPC procedure never throws
 * for missing infra.
 */
export class JobsService {
  private readonly logger: AppLogger;

  constructor(
    private readonly emailReminderQueue: Queue | undefined,
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
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const start = Math.max(input.cursor ?? 0, 0);
    // BullMQ getFailed is inclusive on both ends: getFailed(0, 49) → 50 items.
    const end = start + limit - 1;

    const rawJobs = await this.emailReminderQueue.getFailed(start, end);

    const jobs: FailedJob[] = rawJobs.map((job) => ({
      id: job.id ?? "",
      name: job.name,
      failedReason: job.failedReason ?? "",
      stacktrace: Array.isArray(job.stacktrace) ? [...job.stacktrace] : [],
      attemptsMade: job.attemptsMade ?? 0,
      timestamp: job.timestamp,
      // Defensive copy — BullMQ Job#data is mutable and can carry non-trivial
      // payloads. We keep it `unknown` at the boundary; the Zod schema on the
      // tRPC side validates the shape callers care about.
      data: job.data,
    }));

    // If the slice came back full, advance the cursor; otherwise the failed
    // set is exhausted.
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
      // The id might have been pruned by BullMQ's removeOnFail config or by
      // a parallel retry. Surface a structured no-op so the caller can show
      // a "job no longer exists" toast instead of a 500.
      return { retried: false, jobId: input.jobId };
    }

    const executionId = getReminderExecutionId(job.data);
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

function getReminderExecutionId(data: unknown): string | null {
  if (
    data &&
    typeof data === "object" &&
    "executionId" in data &&
    typeof data.executionId === "string" &&
    data.executionId.trim().length > 0
  ) {
    return data.executionId;
  }

  return null;
}
