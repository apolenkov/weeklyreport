import type { Job } from "bullmq";
import { describe, expect, it, type Mock, vi } from "vitest";

import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import { type AppLogger, createNullLogger } from "../../../lib/logger.js";
import { AiProviderTestProcessor } from "./ai-provider-test.processor.js";
import type { AiProviderTestJobData } from "./ai-provider-test.queue.js";

interface FailureSeam {
  onJobFailed(
    job: Job<AiProviderTestJobData> | undefined,
    error: Error,
  ): Promise<void>;
}

const STUB_ENV = {
  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,
  REDIS_DB: 15,
} as EnvConfig;

type SpyLogger = AppLogger & {
  readonly error: Mock<
    (message: string, context?: Record<string, unknown>) => void
  >;
};

function makeSpyLogger(): SpyLogger {
  const logger: SpyLogger = {
    debug:
      vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    info: vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    warn: vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    error:
      vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    child: () => logger,
  };
  return logger;
}

function createProcessor(logger: AppLogger = createNullLogger()) {
  const repository = {
    startExecution: vi.fn().mockResolvedValue(true),
    getExecution: vi.fn(),
    completeExecution: vi.fn().mockResolvedValue(true),
  };
  const processor = new AiProviderTestProcessor(
    repository as never,
    { executeTest: vi.fn() } as never,
    STUB_ENV,
    logger,
    null,
  );
  return { processor, repository };
}

// A failed-event job mirrors production delivery: the queue sets the BullMQ
// job id to the execution id. `data` is `unknown` because Redis JSON may
// carry null or a primitive where Job<T> claims an object.
function failedJob(data: unknown): Job<AiProviderTestJobData> {
  return {
    id: "execution-1",
    data,
    attemptsStarted: 3,
    attemptsMade: 3,
    opts: { attempts: 3 },
  } as unknown as Job<AiProviderTestJobData>;
}

describe("AiProviderTestProcessor.onJobFailed malformed payloads", () => {
  it.each([
    ["null", null],
    ["a primitive", 42],
    ["a non-string execution id", { executionId: 42 }],
  ])(
    "logs the failure and writes nothing when job data is %s",
    async (_label, data) => {
      const logger = makeSpyLogger();
      const { processor, repository } = createProcessor(logger);

      await (processor as unknown as FailureSeam).onJobFailed(
        failedJob(data),
        new Error("provider timeout"),
      );

      expect(logger.error).toHaveBeenCalledWith(
        "AI provider test job failed",
        expect.objectContaining({
          executionId: undefined,
          failureCode: "ai_provider_test_job_failed",
        }),
      );
      expect(repository.completeExecution).not.toHaveBeenCalled();
    },
  );

  it("still terminalizes a well-formed exhausted job", async () => {
    const { processor, repository } = createProcessor();

    await (processor as unknown as FailureSeam).onJobFailed(
      failedJob({ executionId: "execution-1", traceId: "trace-1" }),
      new Error("provider timeout"),
    );

    expect(repository.completeExecution).toHaveBeenCalledExactlyOnceWith(
      "execution-1",
      "inconclusive",
      expect.objectContaining({
        failureCode: "ai_provider_test_job_failed",
        executionAttempt: 3,
      }),
    );
  });
});
