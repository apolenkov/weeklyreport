import type { FailedJob } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { AdminJobHandle, AdminJobsQueue } from "./admin-jobs.port.js";
import { JobsService } from "./jobs.service";

interface FakeJob extends AdminJobHandle {
  readonly retry: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly remove: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

function makeJob(
  overrides: Partial<FailedJob> & {
    id: string;
    reminderExecutionId?: string | null;
  },
): FakeJob {
  const { reminderExecutionId = null, ...failedJobOverrides } = overrides;
  return {
    failedJob: {
      name: "send-reminder-email",
      failedReason: "SMTP timeout",
      stacktrace: ["at smtpClient.send (smtp.ts:42)"],
      attemptsMade: 3,
      timestamp: 1_700_000_000_000,
      ...failedJobOverrides,
    },
    reminderExecutionId,
    retry: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    remove: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

function makeQueue(opts: {
  failed: FakeJob[];
  getJob?: (id: string) => FakeJob | undefined;
}) {
  const queue = {
    getFailed: vi.fn((start: number, end: number) => {
      // BullMQ getFailed is inclusive on both bounds.
      return Promise.resolve(opts.failed.slice(start, end + 1));
    }),
    getJob: vi.fn((id: string) => {
      if (opts.getJob) return Promise.resolve(opts.getJob(id));
      return Promise.resolve(
        opts.failed.find((job) => job.failedJob.id === id),
      );
    }),
  } satisfies AdminJobsQueue;
  return queue;
}

describe("JobsService — DLQ admin surface", () => {
  it("listFailed: returns mapped failed jobs with default page size", async () => {
    const failed = Array.from({ length: 3 }, (_, i) =>
      makeJob({ id: `job-${i}`, attemptsMade: i + 1 }),
    );
    const service = new JobsService(makeQueue({ failed }));

    const result = await service.listFailed({ queue: "email-reminder" });

    expect(result.jobs).toHaveLength(3);
    expect(result.jobs[0]).toMatchObject({
      id: "job-0",
      name: "send-reminder-email",
      failedReason: "SMTP timeout",
      attemptsMade: 1,
      timestamp: 1_700_000_000_000,
    });
    expect(result.jobs[0]?.stacktrace).toEqual([
      "at smtpClient.send (smtp.ts:42)",
    ]);
    // 3 jobs returned in a 50-slot page → cursor is exhausted.
    expect(result.nextCursor).toBeNull();
  });

  it("listFailed: uses (start, start+limit-1) as inclusive bounds for BullMQ pagination", async () => {
    const failed = Array.from({ length: 60 }, (_, i) =>
      makeJob({ id: `job-${i}` }),
    );
    const queue = makeQueue({ failed });
    const service = new JobsService(queue);

    await service.listFailed({ queue: "email-reminder", cursor: 0, limit: 50 });
    expect(queue.getFailed).toHaveBeenCalledWith(0, 49);

    await service.listFailed({
      queue: "email-reminder",
      cursor: 50,
      limit: 50,
    });
    expect(queue.getFailed).toHaveBeenLastCalledWith(50, 99);
  });

  it("listFailed: advances cursor while page is full and returns null when partial", async () => {
    const failed = Array.from({ length: 70 }, (_, i) =>
      makeJob({ id: `job-${i}` }),
    );
    const service = new JobsService(makeQueue({ failed }));

    const page1 = await service.listFailed({
      queue: "email-reminder",
      limit: 50,
    });
    expect(page1.jobs).toHaveLength(50);
    expect(page1.nextCursor).toBe(50);

    const page2 = await service.listFailed({
      queue: "email-reminder",
      cursor: 50,
      limit: 50,
    });
    expect(page2.jobs).toHaveLength(20);
    expect(page2.nextCursor).toBeNull();
  });

  it("listFailed: returns empty list when the Queue handle is absent (test harness)", async () => {
    const service = new JobsService(undefined);
    const result = await service.listFailed({ queue: "email-reminder" });
    expect(result).toEqual({ jobs: [], nextCursor: null });
  });

  it("retryFailed: calls job.retry() on the resolved job and reports retried=true", async () => {
    const job = makeJob({ id: "job-99" });
    const service = new JobsService(makeQueue({ failed: [job] }));

    const result = await service.retryFailed({
      queue: "email-reminder",
      jobId: "job-99",
    });

    expect(job.retry).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ retried: true, jobId: "job-99" });
  });

  it("retryFailed: removes stale reminder jobs whose execution row no longer exists", async () => {
    const job = makeJob({
      id: "job-stale",
      reminderExecutionId: "missing-execution",
    });
    const service = new JobsService(makeQueue({ failed: [job] }), undefined, {
      reminderExecutionExists: vi.fn().mockResolvedValue(false),
    });

    const result = await service.retryFailed({
      queue: "email-reminder",
      jobId: "job-stale",
    });

    expect(job.retry).not.toHaveBeenCalled();
    expect(job.remove).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      retried: false,
      removed: true,
      reason: "Reminder execution missing-execution no longer exists.",
      jobId: "job-stale",
    });
  });

  it("retryFailed: retries reminder jobs when the execution row still exists", async () => {
    const job = makeJob({
      id: "job-live",
      reminderExecutionId: "existing-execution",
    });
    const service = new JobsService(makeQueue({ failed: [job] }), undefined, {
      reminderExecutionExists: vi.fn().mockResolvedValue(true),
    });

    const result = await service.retryFailed({
      queue: "email-reminder",
      jobId: "job-live",
    });

    expect(job.remove).not.toHaveBeenCalled();
    expect(job.retry).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ retried: true, jobId: "job-live" });
  });

  it("retryFailed: retries an execution job when no existence check is configured", async () => {
    const job = makeJob({
      id: "job-without-existence-check",
      reminderExecutionId: "unchecked-execution",
    });
    const service = new JobsService(makeQueue({ failed: [job] }));

    const result = await service.retryFailed({
      queue: "email-reminder",
      jobId: job.failedJob.id,
    });

    expect(job.remove).not.toHaveBeenCalled();
    expect(job.retry).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ retried: true, jobId: job.failedJob.id });
  });

  it("retryFailed: returns retried=false when the job no longer exists (pruned / parallel retry)", async () => {
    const service = new JobsService(
      makeQueue({ failed: [], getJob: () => undefined }),
    );

    const result = await service.retryFailed({
      queue: "email-reminder",
      jobId: "gone",
    });

    expect(result).toEqual({ retried: false, jobId: "gone" });
  });

  it("retryFailed: returns retried=false when the Queue handle is absent", async () => {
    const service = new JobsService(undefined);
    const result = await service.retryFailed({
      queue: "email-reminder",
      jobId: "job-1",
    });
    expect(result).toEqual({ retried: false, jobId: "job-1" });
  });
});
