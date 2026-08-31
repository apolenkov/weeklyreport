import type { AiProviderConfigurationRead } from "@customreport/shared";
import type { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import { createNullLogger } from "../../../lib/logger.js";
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
        failureCode: string | null,
        checks: readonly PersistedCheck[] = [],
        attempt: number,
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
): AiProviderTestProcessor =>
  new AiProviderTestProcessor(
    repository as never,
    { executeTest } as unknown as AiProviderConfigurationService,
    STUB_ENV,
    createNullLogger(),
    null,
  );

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
