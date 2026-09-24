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
  AdminPdfExportIdentity,
  AdminPdfExportRetryOutcome,
  AdminPdfExportRetryQueue,
} from "./admin-jobs.port.js";
import { JobsService } from "./jobs.service";

interface FakeJob extends AdminJobHandle {
  readonly getState: ReturnType<typeof vi.fn<() => Promise<string>>>;
  readonly retry: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly remove: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

type RetryFailedPdfExport = (input: {
  identity: AdminPdfExportIdentity;
  queue: AdminPdfExportRetryQueue;
}) => Promise<AdminPdfExportRetryOutcome>;

function makeJob(
  overrides: Partial<FailedJob> & {
    id: string;
    queue?: QueueName;
    reminderExecutionId?: string | null;
    pdfExportIdentity?: AdminPdfExportIdentity | null;
    state?: string;
  },
): FakeJob {
  const {
    queue = "email-reminder",
    reminderExecutionId = null,
    pdfExportIdentity,
    state = "failed",
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
      queue === "email-reminder"
        ? { queue, reminderExecutionId }
        : queue === "pdf-export"
          ? {
              queue,
              pdfExportIdentity:
                pdfExportIdentity === undefined
                  ? {
                      jobId: overrides.id,
                      reportId: "report-1",
                      requestedBy: "user-1",
                    }
                  : pdfExportIdentity,
            }
          : { queue },
    getState: vi.fn<() => Promise<string>>().mockResolvedValue(state),
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
  retryFailedPdfExport: vi
    .fn<RetryFailedPdfExport>()
    .mockResolvedValue("retried"),
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

  it("listFailed: fails loud when the registry returns a handle from another queue domain", async () => {
    const job = makeJob({ id: "miswired-listed", queue: "email-reminder" });
    const service = new JobsService(
      {
        names: QUEUE_NAMES,
        get: () => makeQueue({ failed: [job] }),
      },
      defaultOptions,
    );

    await expect(
      service.listFailed({ queue: "ai-provider-test" }),
    ).rejects.toThrow(
      "Queue adapter mismatch: requested ai-provider-test, received email-reminder.",
    );
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
    const retryFailedPdfExport = vi.fn<RetryFailedPdfExport>();
    const service = new JobsService(
      makeRegistry(makeQueue({ failed: [job] })),
      {
        reminderExecutionExists: vi.fn().mockResolvedValue(false),
        retryFailedPdfExport,
      },
    );

    const result = await service.retryFailed({
      queue: "email-reminder",
      jobId: "job-stale",
    });

    expect(job.retry).not.toHaveBeenCalled();
    expect(job.remove).toHaveBeenCalledTimes(1);
    expect(retryFailedPdfExport).not.toHaveBeenCalled();
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
    const reviveFailedReminderExecution = vi.fn().mockResolvedValue(undefined);
    const retryFailedPdfExport = vi.fn<RetryFailedPdfExport>();
    const service = new JobsService(
      makeRegistry(makeQueue({ failed: [job] })),
      {
        reminderExecutionExists: vi.fn().mockResolvedValue(true),
        reviveFailedReminderExecution,
        retryFailedPdfExport,
      },
    );

    const result = await service.retryFailed({
      queue: "email-reminder",
      jobId: "job-live",
    });

    expect(job.remove).not.toHaveBeenCalled();
    expect(reviveFailedReminderExecution).toHaveBeenCalledWith(
      "existing-execution",
    );
    expect(job.retry).toHaveBeenCalledTimes(1);
    expect(retryFailedPdfExport).not.toHaveBeenCalled();
    expect(result).toEqual({ retried: true, jobId: "job-live" });
  });

  it.each(
    QUEUE_NAMES.filter(
      (queue): queue is Exclude<QueueName, "email-reminder" | "pdf-export"> =>
        queue !== "email-reminder" && queue !== "pdf-export",
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
      const retryFailedPdfExport = vi.fn<RetryFailedPdfExport>();
      const registry = {
        names: QUEUE_NAMES,
        get: (name: QueueName) =>
          makeQueue({ failed: name === queue ? [job] : [] }),
      };
      const service = new JobsService(registry, {
        reminderExecutionExists,
        retryFailedPdfExport,
      });

      const result = await service.retryFailed({
        queue,
        jobId: job.failedJob.id,
      });

      expect(reminderExecutionExists).not.toHaveBeenCalled();
      expect(retryFailedPdfExport).not.toHaveBeenCalled();
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
      {
        reminderExecutionExists,
        retryFailedPdfExport: vi.fn<RetryFailedPdfExport>(),
      },
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

  it.each(["active", "completed", "waiting"] as const)(
    "retryFailed: declines an email-reminder job in %s state before reminder handling",
    async (state) => {
      const job = makeJob({
        id: `job-${state}`,
        reminderExecutionId: "existing-execution",
        state,
      });
      const reminderExecutionExists = vi.fn().mockResolvedValue(true);
      const reviveFailedReminderExecution = vi
        .fn()
        .mockResolvedValue(undefined);
      const retryFailedPdfExport = vi.fn<RetryFailedPdfExport>();
      const service = new JobsService(
        makeRegistry(makeQueue({ failed: [job] })),
        {
          reminderExecutionExists,
          reviveFailedReminderExecution,
          retryFailedPdfExport,
        },
      );

      const result = await service.retryFailed({
        queue: "email-reminder",
        jobId: job.failedJob.id,
      });

      expect(result).toMatchObject({
        retried: false,
        jobId: job.failedJob.id,
      });
      // The failed-state guard runs before every reminder-domain mutation.
      expect(job.getState).toHaveBeenCalled();
      expect(reminderExecutionExists).not.toHaveBeenCalled();
      expect(reviveFailedReminderExecution).not.toHaveBeenCalled();
      expect(job.retry).not.toHaveBeenCalled();
      expect(job.remove).not.toHaveBeenCalled();
      expect(retryFailedPdfExport).not.toHaveBeenCalled();
    },
  );

  it("retryFailed: leaves a stale-reminder job untouched while it is not failed", async () => {
    const job = makeJob({
      id: "job-stale-completed",
      reminderExecutionId: "missing-execution",
      state: "completed",
    });
    const reminderExecutionExists = vi.fn().mockResolvedValue(false);
    const service = new JobsService(
      makeRegistry(makeQueue({ failed: [job] })),
      {
        reminderExecutionExists,
        reviveFailedReminderExecution: vi.fn(),
        retryFailedPdfExport: vi.fn<RetryFailedPdfExport>(),
      },
    );

    const result = await service.retryFailed({
      queue: "email-reminder",
      jobId: "job-stale-completed",
    });

    expect(result).toMatchObject({
      retried: false,
      jobId: "job-stale-completed",
    });
    expect(job.getState).toHaveBeenCalled();
    expect(reminderExecutionExists).not.toHaveBeenCalled();
    expect(job.remove).not.toHaveBeenCalled();
    expect(job.retry).not.toHaveBeenCalled();
  });

  it.each(["active", "completed", "waiting"] as const)(
    "retryFailed: declines a %s job on a non-reminder queue without mutation",
    async (state) => {
      const job = makeJob({
        id: `semantic-${state}`,
        queue: "semantic-index",
        state,
      });
      const reminderExecutionExists = vi.fn();
      const retryFailedPdfExport = vi.fn<RetryFailedPdfExport>();
      const service = new JobsService(
        makeRegistry(makeQueue({ failed: [job] }), "semantic-index"),
        { reminderExecutionExists, retryFailedPdfExport },
      );

      const result = await service.retryFailed({
        queue: "semantic-index",
        jobId: job.failedJob.id,
      });

      expect(result).toMatchObject({
        retried: false,
        jobId: job.failedJob.id,
      });
      expect(job.getState).toHaveBeenCalled();
      expect(reminderExecutionExists).not.toHaveBeenCalled();
      expect(retryFailedPdfExport).not.toHaveBeenCalled();
      expect(job.retry).not.toHaveBeenCalled();
      expect(job.remove).not.toHaveBeenCalled();
    },
  );

  it("retryFailed: checks the named queue domain before the job state", async () => {
    const job = makeJob({
      id: "miswired-active",
      queue: "email-reminder",
      state: "active",
    });
    const reminderExecutionExists = vi.fn();
    const service = new JobsService(
      {
        names: QUEUE_NAMES,
        get: () => makeQueue({ failed: [job] }),
      },
      {
        reminderExecutionExists,
        retryFailedPdfExport: vi.fn<RetryFailedPdfExport>(),
      },
    );

    await expect(
      service.retryFailed({
        queue: "ai-provider-test",
        jobId: job.failedJob.id,
      }),
    ).rejects.toThrow(
      "Queue adapter mismatch: requested ai-provider-test, received email-reminder.",
    );

    expect(job.getState).not.toHaveBeenCalled();
    expect(reminderExecutionExists).not.toHaveBeenCalled();
    expect(job.retry).not.toHaveBeenCalled();
    expect(job.remove).not.toHaveBeenCalled();
  });

  it.each(["active", "completed", "waiting"] as const)(
    "removeFailed: declines to remove a job in %s state",
    async (state) => {
      const job = makeJob({
        id: `remove-${state}`,
        queue: "semantic-index",
        state,
      });
      const service = new JobsService(
        makeRegistry(makeQueue({ failed: [job] }), "semantic-index"),
        defaultOptions,
      );

      const result = await service.removeFailed({
        queue: "semantic-index",
        jobId: job.failedJob.id,
      });

      expect(result).toEqual({ removed: false, jobId: job.failedJob.id });
      expect(job.getState).toHaveBeenCalled();
      expect(job.remove).not.toHaveBeenCalled();
    },
  );

  it("removeFailed: removes a job that is still failed", async () => {
    const job = makeJob({ id: "remove-failed" });
    const service = new JobsService(
      makeRegistry(makeQueue({ failed: [job] })),
      defaultOptions,
    );

    const result = await service.removeFailed({
      queue: "email-reminder",
      jobId: "remove-failed",
    });

    expect(result).toEqual({ removed: true, jobId: "remove-failed" });
    expect(job.getState).toHaveBeenCalled();
    expect(job.remove).toHaveBeenCalledTimes(1);
  });

  it("removeFailed: returns removed=false when the job no longer exists", async () => {
    const service = new JobsService(
      makeRegistry(makeQueue({ failed: [], getJob: () => undefined })),
      defaultOptions,
    );

    await expect(
      service.removeFailed({ queue: "email-reminder", jobId: "gone" }),
    ).resolves.toEqual({ removed: false, jobId: "gone" });
  });

  it("removeFailed: checks the named queue domain before the job state", async () => {
    const job = makeJob({
      id: "miswired-completed",
      queue: "email-reminder",
      state: "completed",
    });
    const service = new JobsService(
      {
        names: QUEUE_NAMES,
        get: () => makeQueue({ failed: [job] }),
      },
      defaultOptions,
    );

    await expect(
      service.removeFailed({
        queue: "ai-provider-test",
        jobId: job.failedJob.id,
      }),
    ).rejects.toThrow(
      "Queue adapter mismatch: requested ai-provider-test, received email-reminder.",
    );

    expect(job.getState).not.toHaveBeenCalled();
    expect(job.remove).not.toHaveBeenCalled();
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

describe("JobsService — pdf-export coordinated retry", () => {
  function pdfQueue(job: FakeJob) {
    return {
      names: QUEUE_NAMES,
      get: (name: QueueName) =>
        name === "pdf-export"
          ? makeQueue({ failed: [job] })
          : makeQueue({ failed: [] }),
    } satisfies AdminJobsQueueRegistry;
  }

  it("delegates to the coordinated seam instead of a bare queue retry", async () => {
    const job = makeJob({ id: "pdf-job-1", queue: "pdf-export" });
    const reminderExecutionExists = vi.fn();
    const retryFailedPdfExport = vi
      .fn<RetryFailedPdfExport>()
      .mockResolvedValue("retried");
    const service = new JobsService(pdfQueue(job), {
      reminderExecutionExists,
      retryFailedPdfExport,
    });

    const result = await service.retryFailed({
      queue: "pdf-export",
      jobId: "pdf-job-1",
    });

    expect(result).toEqual({ retried: true, jobId: "pdf-job-1" });
    // The seam received the payload identity plus the live queue primitives;
    // the service never touches job.retry() itself on this path.
    expect(reminderExecutionExists).not.toHaveBeenCalled();
    expect(job.retry).not.toHaveBeenCalled();
    expect(retryFailedPdfExport).toHaveBeenCalledTimes(1);
    const input = retryFailedPdfExport.mock.calls[0]?.[0];
    expect(input?.identity).toEqual({
      jobId: "pdf-job-1",
      reportId: "report-1",
      requestedBy: "user-1",
    });
    await expect(input?.queue.isFailed()).resolves.toBe(true);
    await input?.queue.retry();
    expect(job.retry).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ jobId: "pdf-job-null", identity: null }, "pdf-job-null"],
    [
      {
        jobId: "pdf-job-mismatch",
        identity: {
          jobId: "other-job",
          reportId: "report-1",
          requestedBy: "user-1",
        },
      },
      "pdf-job-mismatch",
    ],
  ] as const)(
    "rejects malformed or mismatched payload identity with zero writes and zero retry",
    async ({ jobId, identity }, requestedId) => {
      const job = makeJob({
        id: jobId,
        queue: "pdf-export",
        pdfExportIdentity: identity,
      });
      const retryFailedPdfExport = vi.fn<RetryFailedPdfExport>();
      const service = new JobsService(pdfQueue(job), {
        reminderExecutionExists: vi.fn(),
        retryFailedPdfExport,
      });

      const result = await service.retryFailed({
        queue: "pdf-export",
        jobId: requestedId,
      });

      expect(result).toEqual({
        retried: false,
        jobId: requestedId,
        reason: "PDF export payload identity is missing or mismatched.",
      });
      expect(retryFailedPdfExport).not.toHaveBeenCalled();
      expect(job.getState).not.toHaveBeenCalled();
      expect(job.retry).not.toHaveBeenCalled();
      expect(job.remove).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      outcome: "queue-not-failed" as const,
      reason: "PDF export queue job is no longer failed.",
    },
    {
      outcome: "ineligible" as const,
      reason:
        "PDF export row is missing, not failed, or bound to another payload.",
    },
  ])(
    "maps a declined pdf-export outcome ($outcome) to retried=false",
    async ({ outcome, reason }) => {
      const job = makeJob({ id: "pdf-job-2", queue: "pdf-export" });
      const retryFailedPdfExport = vi
        .fn<RetryFailedPdfExport>()
        .mockResolvedValue(outcome);
      const service = new JobsService(pdfQueue(job), {
        reminderExecutionExists: vi.fn(),
        retryFailedPdfExport,
      });

      const result = await service.retryFailed({
        queue: "pdf-export",
        jobId: "pdf-job-2",
      });

      expect(result).toEqual({ retried: false, jobId: "pdf-job-2", reason });
      expect(job.retry).not.toHaveBeenCalled();
    },
  );

  it("propagates a rejected coordinated retry as an uncertain error, not a success", async () => {
    const job = makeJob({ id: "pdf-job-3", queue: "pdf-export" });
    const retryFailedPdfExport = vi
      .fn<RetryFailedPdfExport>()
      .mockRejectedValue(new Error("queue.retry acknowledgement lost"));
    const service = new JobsService(pdfQueue(job), {
      reminderExecutionExists: vi.fn(),
      retryFailedPdfExport,
    });

    await expect(
      service.retryFailed({ queue: "pdf-export", jobId: "pdf-job-3" }),
    ).rejects.toThrow("queue.retry acknowledgement lost");
    expect(job.retry).not.toHaveBeenCalled();
  });

  it("delegates a non-failed queue job to the coordinated seam without an eager precheck", async () => {
    const job = makeJob({
      id: "pdf-job-active",
      queue: "pdf-export",
      state: "active",
    });
    const retryFailedPdfExport = vi
      .fn<RetryFailedPdfExport>()
      .mockImplementation(async ({ queue }) =>
        (await queue.isFailed()) ? "retried" : "queue-not-failed",
      );
    const service = new JobsService(pdfQueue(job), {
      reminderExecutionExists: vi.fn(),
      retryFailedPdfExport,
    });

    const result = await service.retryFailed({
      queue: "pdf-export",
      jobId: "pdf-job-active",
    });

    // The seam arbitrates state under the export row lock; the only getState
    // call is the one it makes through isFailed — no service-level precheck.
    expect(retryFailedPdfExport).toHaveBeenCalledTimes(1);
    expect(job.getState).toHaveBeenCalledTimes(1);
    expect(job.retry).not.toHaveBeenCalled();
    expect(result).toEqual({
      retried: false,
      jobId: "pdf-job-active",
      reason: "PDF export queue job is no longer failed.",
    });
  });
});
