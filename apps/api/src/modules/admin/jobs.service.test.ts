import {
  type FailedJob,
  QUEUE_NAMES,
  type QueueName,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type {
  AdminJobHandle,
  AdminJobsQueue,
  AdminJobsQueueRegistry,
} from "./admin-jobs.port.js";
import { JobsService } from "./jobs.service";

interface FakeJob extends AdminJobHandle {
  readonly retry: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly remove: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

function makeJob(
  overrides: Partial<FailedJob> & {
    id: string;
    queue?: QueueName;
    reminderExecutionId?: string | null;
  },
): FakeJob {
  const {
    queue = "email-reminder",
    reminderExecutionId = null,
    ...failedJobOverrides
  } = overrides;
  return {
    failedJob: {
      name: "send-reminder-email",
      failedReason: "SMTP timeout",
      stacktrace: ["at smtpClient.send (smtp.ts:42)"],
      attemptsMade: 3,
      timestamp: 1_700_000_000_000,
      ...failedJobOverrides,
    },
    domainReference:
      queue === "email-reminder" ? { queue, reminderExecutionId } : { queue },
    retry: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    remove: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

function makeQueue(opts: {
  failed: FakeJob[];
  getJob?: (id: string) => FakeJob | undefined;
  failedCount?: number;
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
    getFailedCount: vi.fn(() =>
      Promise.resolve(opts.failedCount ?? opts.failed.length),
    ),
  } satisfies AdminJobsQueue;
  return queue;
}

function makeRegistry(
  queue: AdminJobsQueue,
  queueName: QueueName = "email-reminder",
): AdminJobsQueueRegistry {
  return {
    names: QUEUE_NAMES,
    get: (name) =>
      name === queueName ? queue : makeQueue({ failed: [], failedCount: 0 }),
  };
}

const defaultOptions = {
  reminderExecutionExists: vi.fn().mockResolvedValue(true),
};

describe("JobsService — DLQ admin surface", () => {
  it.each(QUEUE_NAMES)(
    "lists failed jobs for the monitored %s queue",
    async (queue) => {
      const job = makeJob({ id: `${queue}-job`, queue });
      const registry = {
        names: QUEUE_NAMES,
        get: (name: (typeof QUEUE_NAMES)[number]) =>
          makeQueue({ failed: name === queue ? [job] : [] }),
      };
      const service = new JobsService(registry, defaultOptions);

      await expect(service.listFailed({ queue })).resolves.toEqual({
        jobs: [job.failedJob],
        nextCursor: null,
      });
    },
  );

  it("listFailed: returns mapped failed jobs with default page size", async () => {
    const failed = Array.from({ length: 3 }, (_, i) =>
      makeJob({ id: `job-${i}`, attemptsMade: i + 1 }),
    );
    const service = new JobsService(
      makeRegistry(makeQueue({ failed })),
      defaultOptions,
    );

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
    const service = new JobsService(makeRegistry(queue), defaultOptions);

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
    const service = new JobsService(
      makeRegistry(makeQueue({ failed })),
      defaultOptions,
    );

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

  it("retryFailed: calls job.retry() on the resolved job and reports retried=true", async () => {
    const job = makeJob({ id: "job-99" });
    const service = new JobsService(
      makeRegistry(makeQueue({ failed: [job] })),
      defaultOptions,
    );

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
    const service = new JobsService(
      makeRegistry(makeQueue({ failed: [job] })),
      { reminderExecutionExists: vi.fn().mockResolvedValue(false) },
    );

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

  it("retryFailed: retries a live execution job without treating its old body as authoritative", async () => {
    const job = makeJob({
      id: "job-live",
      reminderExecutionId: "existing-execution",
    });
    const service = new JobsService(
      makeRegistry(makeQueue({ failed: [job] })),
      { reminderExecutionExists: vi.fn().mockResolvedValue(true) },
    );

    const result = await service.retryFailed({
      queue: "email-reminder",
      jobId: "job-live",
    });

    expect(job.remove).not.toHaveBeenCalled();
    expect(job.retry).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ retried: true, jobId: "job-live" });
  });

  it.each(
    QUEUE_NAMES.filter(
      (queue): queue is Exclude<QueueName, "email-reminder"> =>
        queue !== "email-reminder",
    ),
  )(
    "retryFailed: retries a %s executionId in its own domain without reminder validation",
    async (queue) => {
      const job = makeJob({
        id: `${queue}-failed`,
        queue,
        reminderExecutionId: "foreign-execution-id",
      });
      const reminderExecutionExists = vi.fn().mockResolvedValue(false);
      const registry = {
        names: QUEUE_NAMES,
        get: (name: QueueName) =>
          makeQueue({ failed: name === queue ? [job] : [] }),
      };
      const service = new JobsService(registry, {
        reminderExecutionExists,
      });

      const result = await service.retryFailed({
        queue,
        jobId: job.failedJob.id,
      });

      expect(reminderExecutionExists).not.toHaveBeenCalled();
      expect(job.remove).not.toHaveBeenCalled();
      expect(job.retry).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ retried: true, jobId: job.failedJob.id });
    },
  );

  it("retryFailed: fails loud when a registry returns a handle from another queue domain", async () => {
    const job = makeJob({
      id: "miswired-job",
      queue: "email-reminder",
      reminderExecutionId: "reminder-execution",
    });
    const reminderExecutionExists = vi.fn().mockResolvedValue(false);
    const service = new JobsService(
      {
        names: QUEUE_NAMES,
        get: () => makeQueue({ failed: [job] }),
      },
      { reminderExecutionExists },
    );

    await expect(
      service.retryFailed({
        queue: "ai-provider-test",
        jobId: job.failedJob.id,
      }),
    ).rejects.toThrow(
      "Queue adapter mismatch: requested ai-provider-test, received email-reminder.",
    );

    expect(reminderExecutionExists).not.toHaveBeenCalled();
    expect(job.remove).not.toHaveBeenCalled();
    expect(job.retry).not.toHaveBeenCalled();
  });

  it("retryFailed: returns retried=false when the job no longer exists (pruned / parallel retry)", async () => {
    const service = new JobsService(
      makeRegistry(makeQueue({ failed: [], getJob: () => undefined })),
      defaultOptions,
    );

    const result = await service.retryFailed({
      queue: "email-reminder",
      jobId: "gone",
    });

    expect(result).toEqual({ retried: false, jobId: "gone" });
  });

  it("countFailed: sums exact counts from every registered queue", async () => {
    const counts = new Map(
      QUEUE_NAMES.map((name, index) => [name, index + 1] as const),
    );
    const getFailedCounts = new Map<QueueName, ReturnType<typeof vi.fn>>();
    const registry: AdminJobsQueueRegistry = {
      names: QUEUE_NAMES,
      get: (name) => {
        const getFailedCount = vi.fn().mockResolvedValue(counts.get(name));
        getFailedCounts.set(name, getFailedCount);
        return {
          ...makeQueue({ failed: [], failedCount: 999 }),
          getFailedCount,
        };
      },
    };
    const service = new JobsService(registry, defaultOptions);

    await expect(service.countFailed()).resolves.toBe(
      QUEUE_NAMES.reduce((sum, name) => sum + (counts.get(name) ?? 0), 0),
    );
    for (const name of QUEUE_NAMES) {
      expect(getFailedCounts.get(name)).toHaveBeenCalledOnce();
    }
  });
});
