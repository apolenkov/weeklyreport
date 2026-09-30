import type { AiProviderConfigurationRead } from "@customreport/shared";
import { type Job, UnrecoverableError } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import { type AppLogger, createNullLogger } from "../../../lib/logger.js";
import { AiProviderConfigurationService } from "../application/ai-provider.service.js";
import { AiProviderTestProcessor } from "./ai-provider-test.processor.js";
import type { AiProviderTestJobData } from "./ai-provider-test.queue.js";

type ExecutionOutcome =
  "passed" | "incompatible" | "configuration_error" | "inconclusive";

type ExecutionState = "queued" | "running" | "completed";

type PersistedCheck = Readonly<{
  code: string;
  outcome: "passed" | "incompatible" | "inconclusive";
  passedCount: number;
  failedCount: number;
}>;

type Completion = Readonly<{
  outcome: ExecutionOutcome;
  failureCode: string | null;
  checks: readonly PersistedCheck[];
}>;

interface ProcessorTestSeam {
  processJob(job: Job<AiProviderTestJobData>): Promise<void>;
  onJobFailed(
    job: Job<AiProviderTestJobData> | undefined,
    error: Error,
  ): unknown;
}

const STUB_ENV = {
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
  REDIS_DB: 15,
} as EnvConfig;

const jobData: AiProviderTestJobData = {
  executionId: "execution-1",
  traceId: "trace-1",
};

const createJob = (): Job<AiProviderTestJobData> =>
  ({
    data: jobData,
    attemptsStarted: 1,
  }) as Job<AiProviderTestJobData>;

const testResult = {
  status: "passed" as const,
  generation: {
    status: "passed" as const,
    capabilities: [
      { capability: "authentication" as const, status: "passed" as const },
      {
        capability: "structured_answer" as const,
        status: "passed" as const,
      },
    ],
  },
  embeddings: {
    status: "passed" as const,
    capabilities: [
      {
        capability: "batch_embeddings" as const,
        status: "passed" as const,
      },
    ],
  },
  testedAt: null,
};

const executedTest = (result = testResult): AiProviderConfigurationRead =>
  ({ testResult: result }) as AiProviderConfigurationRead;

const createExecutionHarness = (
  initialState: "queued" | "completed" = "queued",
) => {
  let state: ExecutionState = initialState;
  const stateHistory: ExecutionState[] = [state];
  let executionAttempt: number | null = null;
  let completion: Completion | null = null;

  const repository = {
    startExecution: vi.fn((executionId: string, attempt: number) => {
      if (executionId !== jobData.executionId || state === "completed") {
        return Promise.resolve(false);
      }
      if (state === "running" && executionAttempt === attempt) {
        return Promise.resolve(false);
      }
      if (
        state === "running" &&
        (executionAttempt === null || executionAttempt > attempt)
      ) {
        return Promise.resolve(false);
      }
      state = "running";
      executionAttempt = attempt;
      stateHistory.push(state);
      return Promise.resolve(true);
    }),
    getExecution: vi.fn((executionId: string) =>
      Promise.resolve(
        executionId === jobData.executionId && state === "running"
          ? { providerRevisionId: "provider-revision-1" }
          : null,
      ),
    ),
    completeExecution: vi.fn(
      (
        executionId: string,
        outcome: ExecutionOutcome,
        {
          failureCode,
          checks = [],
          executionAttempt: attempt,
        }: Readonly<{
          failureCode: string | null;
          checks?: readonly PersistedCheck[];
          executionAttempt: number;
        }>,
      ) => {
        if (
          executionId !== jobData.executionId ||
          state !== "running" ||
          executionAttempt !== attempt
        ) {
          return Promise.resolve(false);
        }
        completion = { outcome, failureCode, checks };
        state = "completed";
        stateHistory.push(state);
        return Promise.resolve(true);
      },
    ),
  };

  return {
    repository,
    stateHistory,
    completion: () => completion,
  };
};

const createProcessor = (
  repository: ReturnType<typeof createExecutionHarness>["repository"],
  executeTest: ReturnType<typeof vi.fn>,
  logger: AppLogger = createNullLogger(),
): AiProviderTestProcessor =>
  new AiProviderTestProcessor(
    repository as never,
    { executeTest } as unknown as AiProviderConfigurationService,
    STUB_ENV,
    logger,
    null,
  );

type LogRecord = Readonly<{
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context: Record<string, unknown> | undefined;
}>;

const createRecordingLogger = (): {
  logger: AppLogger;
  entries: LogRecord[];
} => {
  const entries: LogRecord[] = [];
  const logger: AppLogger = {
    debug: (message, context) => {
      entries.push({ level: "debug", message, context });
    },
    info: (message, context) => {
      entries.push({ level: "info", message, context });
    },
    warn: (message, context) => {
      entries.push({ level: "warn", message, context });
    },
    error: (message, context) => {
      entries.push({ level: "error", message, context });
    },
    child: () => logger,
  };
  return { logger, entries };
};

// A failed-event job mirrors production delivery: the queue sets the BullMQ
// job id to the execution id, attemptsStarted tracks every activation
// (including stalled recoveries) and attemptsMade only finished attempts.
const createFailedJob = (
  overrides: Readonly<{
    attemptsStarted?: number;
    attemptsMade?: number;
    opts?: Readonly<{ attempts?: number }>;
    id?: string;
    data?: AiProviderTestJobData;
  }> = {},
): Job<AiProviderTestJobData> =>
  ({
    id: overrides.id ?? overrides.data?.executionId ?? jobData.executionId,
    data: overrides.data ?? jobData,
    attemptsStarted: overrides.attemptsStarted ?? 3,
    attemptsMade: overrides.attemptsMade ?? 3,
    opts: overrides.opts ?? { attempts: 3 },
  }) as Job<AiProviderTestJobData>;

// Lets a fire-and-forget failure hook settle before asserting zero writes.
const flushAsync = (): Promise<void> =>
  new Promise((resolve) => {
    setImmediate(resolve);
  });

describe("AiProviderTestProcessor.processJob", () => {
  it("starts a queued execution and delegates atomic success persistence", async () => {
    const harness = createExecutionHarness();
    const executeTest = vi.fn().mockResolvedValue(executedTest());
    const processor = createProcessor(harness.repository, executeTest);

    await (processor as unknown as ProcessorTestSeam).processJob(createJob());

    expect(harness.stateHistory).toStrictEqual(["queued", "running"]);
    expect(executeTest).toHaveBeenCalledWith("provider-revision-1", "worker", {
      id: "execution-1",
      attempt: 1,
    });
    expect(harness.repository.completeExecution).not.toHaveBeenCalled();
  });

  it("rejects malformed job data as unrecoverable before touching the repository", async () => {
    const harness = createExecutionHarness();
    const processor = createProcessor(harness.repository, vi.fn());

    await expect(
      (processor as unknown as ProcessorTestSeam).processJob({
        ...createJob(),
        data: {},
      } as Job<AiProviderTestJobData>),
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(harness.repository.startExecution).not.toHaveBeenCalled();
  });

  it("does not call the capability provider when another worker already owns the execution", async () => {
    const harness = createExecutionHarness("completed");
    const executeTest = vi.fn();
    const processor = createProcessor(harness.repository, executeTest);

    await (processor as unknown as ProcessorTestSeam).processJob(createJob());

    expect(harness.repository.startExecution).toHaveBeenCalledWith(
      "execution-1",
      1,
    );
    expect(harness.repository.getExecution).not.toHaveBeenCalled();
    expect(executeTest).not.toHaveBeenCalled();
    expect(harness.repository.completeExecution).not.toHaveBeenCalled();
    expect(harness.stateHistory).toStrictEqual(["completed"]);
  });

  it("classifies an authentication failure and persists it as a terminal configuration error", async () => {
    const harness = createExecutionHarness();
    const executeTest = vi.fn().mockRejectedValue({
      statusCode: 401,
      retryable: false,
    });
    const processor = createProcessor(harness.repository, executeTest);

    await (processor as unknown as ProcessorTestSeam).processJob(createJob());

    expect(harness.stateHistory).toStrictEqual([
      "queued",
      "running",
      "completed",
    ]);
    expect(harness.completion()).toStrictEqual({
      outcome: "configuration_error",
      failureCode: "provider_authentication_failed",
      checks: [],
    });
  });

  it.each([
    {
      label: "retryable provider failure",
      error: {
        statusCode: 503,
        retryable: true,
        message: "upstream unavailable sk-retry-secret",
      },
      outcome: "inconclusive",
      failureCode: "provider_transient_failure",
    },
    {
      label: "schema contract failure",
      error: new Error(
        "provider response failed schema validation sk-schema-secret",
      ),
      outcome: "incompatible",
      failureCode: "provider_contract_incompatible",
    },
    {
      label: "generic provider failure",
      error: new Error("socket hang up sk-generic-secret"),
      outcome: "inconclusive",
      failureCode: "provider_unavailable",
    },
  ])(
    "persists a $label as a bounded $failureCode outcome without raw error details",
    async ({ error, outcome, failureCode }) => {
      const harness = createExecutionHarness();
      const executeTest = vi.fn().mockRejectedValue(error);
      const processor = createProcessor(harness.repository, executeTest);

      await (processor as unknown as ProcessorTestSeam).processJob(createJob());

      expect(harness.stateHistory).toStrictEqual([
        "queued",
        "running",
        "completed",
      ]);
      expect(harness.completion()).toStrictEqual({
        outcome,
        failureCode,
        checks: [],
      });
      expect(
        JSON.stringify(harness.repository.completeExecution.mock.calls),
      ).not.toContain("sk-");
    },
  );

  it("reclaims a stalled retry and prevents the late old worker from completing its newer claim", async () => {
    const harness = createExecutionHarness();
    const firstProviderResponse =
      Promise.withResolvers<AiProviderConfigurationRead>();
    const executeTest = vi
      .fn()
      .mockReturnValueOnce(firstProviderResponse.promise)
      .mockResolvedValueOnce(executedTest());
    const processor = createProcessor(harness.repository, executeTest);

    const firstAttempt = (processor as unknown as ProcessorTestSeam).processJob(
      createJob(),
    );
    await vi.waitFor(() => expect(executeTest).toHaveBeenCalledTimes(1));

    await (processor as unknown as ProcessorTestSeam).processJob({
      data: jobData,
      attemptsStarted: 2,
    } as Job<AiProviderTestJobData>);

    firstProviderResponse.resolve(executedTest());
    await firstAttempt;

    expect(harness.stateHistory).toStrictEqual([
      "queued",
      "running",
      "running",
    ]);
    expect(harness.repository.startExecution).toHaveBeenNthCalledWith(
      2,
      "execution-1",
      2,
    );
    expect(harness.repository.completeExecution).not.toHaveBeenCalled();
  });
});

describe("AiProviderTestProcessor.onJobFailed", () => {
  it("completes the exact claimed attempt as bounded inconclusive once the retry budget is exhausted", async () => {
    const harness = createExecutionHarness();
    // A stalled delivery left attemptsStarted ahead of attemptsMade; the
    // durable claim is attemptsStarted, so the exhausted failure must complete
    // attempt 4, not the attemptsMade counter that only gates the retry budget.
    await harness.repository.startExecution(jobData.executionId, 4);
    const executeTest = vi.fn();
    const processor = createProcessor(harness.repository, executeTest);

    await (processor as unknown as ProcessorTestSeam).onJobFailed(
      createFailedJob({ attemptsStarted: 4, attemptsMade: 3 }),
      new Error("provider timeout"),
    );

    await vi.waitFor(() =>
      expect(harness.repository.completeExecution).toHaveBeenCalledWith(
        "execution-1",
        "inconclusive",
        {
          failureCode: "ai_provider_test_job_failed",
          checks: [],
          executionAttempt: 4,
        },
      ),
    );
    expect(harness.completion()).toStrictEqual({
      outcome: "inconclusive",
      failureCode: "ai_provider_test_job_failed",
      checks: [],
    });
    expect(harness.stateHistory).toStrictEqual([
      "queued",
      "running",
      "completed",
    ]);
    expect(executeTest).not.toHaveBeenCalled();
  });

  it("treats a missing attempts option as a single-attempt budget", async () => {
    const harness = createExecutionHarness();
    await harness.repository.startExecution(jobData.executionId, 1);
    const processor = createProcessor(harness.repository, vi.fn());

    await (processor as unknown as ProcessorTestSeam).onJobFailed(
      createFailedJob({ attemptsStarted: 1, attemptsMade: 1, opts: {} }),
      new Error("provider timeout"),
    );

    await vi.waitFor(() =>
      expect(harness.repository.completeExecution).toHaveBeenCalledWith(
        "execution-1",
        "inconclusive",
        {
          failureCode: "ai_provider_test_job_failed",
          checks: [],
          executionAttempt: 1,
        },
      ),
    );
    expect(harness.completion()?.failureCode).toBe(
      "ai_provider_test_job_failed",
    );
  });

  it("leaves the claimed execution untouched while retry budget remains", async () => {
    const harness = createExecutionHarness();
    await harness.repository.startExecution(jobData.executionId, 2);
    const processor = createProcessor(harness.repository, vi.fn());

    await (processor as unknown as ProcessorTestSeam).onJobFailed(
      createFailedJob({ attemptsStarted: 2, attemptsMade: 1 }),
      new Error("transient provider failure"),
    );
    await flushAsync();

    expect(harness.repository.completeExecution).not.toHaveBeenCalled();
    expect(harness.repository.startExecution).toHaveBeenCalledTimes(1);
    expect(harness.stateHistory).toStrictEqual(["queued", "running"]);
  });

  it("ignores a failed event that carries no job", async () => {
    const harness = createExecutionHarness();
    await harness.repository.startExecution(jobData.executionId, 3);
    const processor = createProcessor(harness.repository, vi.fn());

    await (processor as unknown as ProcessorTestSeam).onJobFailed(
      undefined,
      new Error("job payload lost"),
    );
    await flushAsync();

    expect(harness.repository.completeExecution).not.toHaveBeenCalled();
    expect(harness.repository.startExecution).toHaveBeenCalledTimes(1);
    expect(harness.stateHistory).toStrictEqual(["queued", "running"]);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "ignores a failed event with an invalid processing attempt (%s)",
    async (attemptsStarted) => {
      const harness = createExecutionHarness();
      await harness.repository.startExecution(jobData.executionId, 3);
      const processor = createProcessor(harness.repository, vi.fn());

      await (processor as unknown as ProcessorTestSeam).onJobFailed(
        createFailedJob({ attemptsStarted, attemptsMade: 3 }),
        new Error("provider timeout"),
      );
      await flushAsync();

      expect(harness.repository.completeExecution).not.toHaveBeenCalled();
      expect(harness.repository.startExecution).toHaveBeenCalledTimes(1);
      expect(harness.stateHistory).toStrictEqual(["queued", "running"]);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "ignores a failed event with an invalid attempts counter (%s)",
    async (attemptsMade) => {
      const harness = createExecutionHarness();
      await harness.repository.startExecution(jobData.executionId, 3);
      const processor = createProcessor(harness.repository, vi.fn());

      await (processor as unknown as ProcessorTestSeam).onJobFailed(
        createFailedJob({ attemptsStarted: 3, attemptsMade }),
        new Error("provider timeout"),
      );
      await flushAsync();

      expect(harness.repository.completeExecution).not.toHaveBeenCalled();
      expect(harness.repository.startExecution).toHaveBeenCalledTimes(1);
      expect(harness.stateHistory).toStrictEqual(["queued", "running"]);
    },
  );

  it.each([
    {
      label: "missing",
      data: { traceId: jobData.traceId } as AiProviderTestJobData,
      id: jobData.executionId,
    },
    {
      label: "empty",
      data: { ...jobData, executionId: "" },
      id: "",
    },
  ])(
    "ignores a failed event with a $label execution id",
    async ({ data, id }) => {
      const harness = createExecutionHarness();
      await harness.repository.startExecution(jobData.executionId, 3);
      const processor = createProcessor(harness.repository, vi.fn());

      await (processor as unknown as ProcessorTestSeam).onJobFailed(
        createFailedJob({ data, id, attemptsStarted: 3, attemptsMade: 3 }),
        new Error("provider timeout"),
      );
      await flushAsync();

      expect(harness.repository.completeExecution).not.toHaveBeenCalled();
      expect(harness.repository.startExecution).toHaveBeenCalledTimes(1);
      expect(harness.stateHistory).toStrictEqual(["queued", "running"]);
    },
  );

  it("ignores a failed event whose queue job id differs from the payload execution id", async () => {
    const harness = createExecutionHarness();
    await harness.repository.startExecution(jobData.executionId, 3);
    const processor = createProcessor(harness.repository, vi.fn());

    // The enqueuer sets the BullMQ job id to the execution id, so a mismatch
    // marks a stale or foreign delivery that must not write to the row.
    await (processor as unknown as ProcessorTestSeam).onJobFailed(
      createFailedJob({
        id: "queue-job-9",
        attemptsStarted: 3,
        attemptsMade: 3,
      }),
      new Error("provider timeout"),
    );
    await flushAsync();

    expect(harness.repository.completeExecution).not.toHaveBeenCalled();
    expect(harness.repository.startExecution).toHaveBeenCalledTimes(1);
    expect(harness.stateHistory).toStrictEqual(["queued", "running"]);
  });

  it("lets a superseded claim lose the completion CAS without throwing", async () => {
    const harness = createExecutionHarness();
    // A newer BullMQ delivery already reclaimed the execution, so the exhausted
    // attempt 4 must lose the CAS and leave the running claim alone.
    await harness.repository.startExecution(jobData.executionId, 5);
    const { logger, entries } = createRecordingLogger();
    const processor = createProcessor(harness.repository, vi.fn(), logger);

    await (processor as unknown as ProcessorTestSeam).onJobFailed(
      createFailedJob({ attemptsStarted: 4, attemptsMade: 3 }),
      new Error("provider timeout"),
    );

    await vi.waitFor(() =>
      expect(
        entries.some(
          (entry) =>
            entry.level === "warn" && entry.message.includes("superseded"),
        ),
      ).toBe(true),
    );
    expect(harness.completion()).toBeNull();
    expect(harness.stateHistory).toStrictEqual(["queued", "running"]);
  });

  it("bounds a failed terminal write to a fixed-code error log without raw error details", async () => {
    const harness = createExecutionHarness();
    await harness.repository.startExecution(jobData.executionId, 3);
    // Error messages and enumerable metadata can carry provider credentials,
    // so the hook must log a fixed failure code plus the claim identity —
    // never the raw error, its message, or its cause.
    harness.repository.completeExecution.mockRejectedValueOnce(
      Object.assign(new Error("write refused token=sk-msg-secret"), {
        providerApiKey: "sk-meta-secret",
      }),
    );
    const { logger, entries } = createRecordingLogger();
    const processor = createProcessor(harness.repository, vi.fn(), logger);
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown): void => {
      unhandledRejections.push(reason);
    };
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      await (processor as unknown as ProcessorTestSeam).onJobFailed(
        createFailedJob({ attemptsStarted: 3, attemptsMade: 3 }),
        new Error("provider timeout sk-job-secret"),
      );
      await vi.waitFor(() =>
        expect(
          entries.some(
            (entry) =>
              entry.level === "error" && entry.context?.executionAttempt === 3,
          ),
        ).toBe(true),
      );
      await flushAsync();
      const terminalLog = entries.find(
        (entry) =>
          entry.level === "error" && entry.context?.executionAttempt === 3,
      );
      expect(terminalLog?.context).toStrictEqual({
        executionId: "execution-1",
        executionAttempt: 3,
        failureCode: "ai_provider_test_job_failed",
      });
      expect(unhandledRejections).toStrictEqual([]);
      const serialized = JSON.stringify(entries);
      expect(serialized).not.toContain("sk-job-secret");
      expect(serialized).not.toContain("sk-msg-secret");
      expect(serialized).not.toContain("sk-meta-secret");
      expect(harness.stateHistory).toStrictEqual(["queued", "running"]);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
});
