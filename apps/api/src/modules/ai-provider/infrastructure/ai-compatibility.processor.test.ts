import type { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../../lib/logger.js";
import { AiCompatibilityProcessor } from "./ai-compatibility.processor.js";
import type { AiCompatibilityJobData } from "./ai-compatibility.queue.js";

const secret = "provider-secret-that-must-never-escape";
const executionId = "11111111-1111-4111-8111-111111111111";

const job = {
  data: {
    traceId: "trace-1",
    executionId,
    kind: "provider_test",
  },
} as Job<AiCompatibilityJobData>;

const promptJob = {
  data: {
    traceId: "trace-1",
    executionId,
    kind: "prompt_evaluation",
  },
} as Job<AiCompatibilityJobData>;

const logger = (): Readonly<{
  instance: AppLogger;
  entries: readonly Readonly<Record<string, unknown>>[];
}> => {
  const entries: Record<string, unknown>[] = [];
  const instance: AppLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn((message: string, context?: Record<string, unknown>) =>
      entries.push({ message, ...context }),
    ),
    child: vi.fn(() => instance),
  };
  return { instance, entries };
};

const processorFor = (input: {
  repository: Readonly<Record<string, unknown>>;
  providerService: Readonly<Record<string, unknown>>;
  promptService?: Readonly<Record<string, unknown>>;
  logger?: AppLogger;
}): AiCompatibilityProcessor =>
  new AiCompatibilityProcessor(
    input.repository as never,
    input.providerService as never,
    (input.promptService ?? {}) as never,
    {} as never,
    input.logger,
  );

describe("AiCompatibilityProcessor secret boundaries", () => {
  it("persists a bounded failure code when a provider error contains a credential", async () => {
    const completeExecution = vi.fn().mockResolvedValue(undefined);
    const processor = processorFor({
      repository: {
        startExecution: vi.fn().mockResolvedValue(true),
        getExecution: vi.fn().mockResolvedValue({
          providerRevisionId: "22222222-2222-4222-8222-222222222222",
          promptRevisionId: null,
          featureKey: null,
        }),
        completeExecution,
      },
      providerService: {
        executeTest: vi
          .fn()
          .mockRejectedValue(new Error(`request failed: ${secret}`)),
      },
    });

    await (
      processor as unknown as {
        processJob(value: Job<AiCompatibilityJobData>): Promise<void>;
      }
    ).processJob(job);

    expect(completeExecution).toHaveBeenCalledWith(
      executionId,
      "inconclusive",
      "provider_unavailable",
    );
    expect(JSON.stringify(completeExecution.mock.calls)).not.toContain(secret);
  });

  it("logs only execution identity and a bounded code after terminal job failure", () => {
    const captured = logger();
    const processor = processorFor({
      repository: {},
      providerService: {},
      logger: captured.instance,
    });

    (
      processor as unknown as {
        onJobFailed(value: Job<AiCompatibilityJobData>, error: Error): void;
      }
    ).onJobFailed(job, new Error(`upstream echoed ${secret}`));

    expect(captured.entries).toEqual([
      {
        message: "AI compatibility job failed",
        executionId,
        failureCode: "ai_compatibility_job_failed",
      },
    ]);
    expect(JSON.stringify(captured.entries)).not.toContain(secret);
  });

  it("preserves inconclusive prompt evaluations in the durable execution", async () => {
    const completeExecution = vi.fn().mockResolvedValue(undefined);
    const processor = processorFor({
      repository: {
        startExecution: vi.fn().mockResolvedValue(true),
        getExecution: vi.fn().mockResolvedValue({
          providerRevisionId: "22222222-2222-4222-8222-222222222222",
          promptRevisionId: "33333333-3333-4333-8333-333333333333",
          featureKey: "lead-report-assistant",
        }),
        completeExecution,
      },
      providerService: {},
      promptService: {
        executeEvaluation: vi.fn().mockResolvedValue({
          latestEvaluation: {
            outcome: "inconclusive",
            checks: [
              {
                code: "provider_probe_failed",
                status: "inconclusive",
                passedCount: 0,
                failedCount: 1,
              },
            ],
          },
        }),
      },
    });

    await (
      processor as unknown as {
        processJob(value: Job<AiCompatibilityJobData>): Promise<void>;
      }
    ).processJob(promptJob);

    expect(completeExecution).toHaveBeenCalledWith(
      executionId,
      "inconclusive",
      null,
      [
        {
          code: "provider_probe_failed",
          outcome: "inconclusive",
          passedCount: 0,
          failedCount: 1,
        },
      ],
    );
  });

  it("persists the composite inconclusive outcome and feature checks", async () => {
    const completeExecution = vi.fn().mockResolvedValue(undefined);
    const processor = processorFor({
      repository: {
        startExecution: vi.fn().mockResolvedValue(true),
        getExecution: vi.fn().mockResolvedValue({
          providerRevisionId: "22222222-2222-4222-8222-222222222222",
          promptRevisionId: null,
          featureKey: null,
        }),
        completeExecution,
      },
      providerService: {
        executeTest: vi.fn().mockResolvedValue({
          testResult: {
            status: "inconclusive",
            generation: {
              status: "passed",
              capabilities: [
                { capability: "planner_tool_call", status: "passed" },
              ],
              featureCompatibility: [
                {
                  featureKey: "lead-report-assistant",
                  checks: [
                    {
                      code: "protocol_shape",
                      status: "inconclusive",
                      passedCount: 0,
                      failedCount: 1,
                    },
                  ],
                },
              ],
            },
            embeddings: { status: "passed", capabilities: [] },
          },
        }),
      },
    });

    await (
      processor as unknown as {
        processJob(value: Job<AiCompatibilityJobData>): Promise<void>;
      }
    ).processJob(job);

    expect(completeExecution).toHaveBeenCalledWith(
      executionId,
      "inconclusive",
      null,
      [
        {
          code: "generation.planner_tool_call",
          outcome: "passed",
          passedCount: 1,
          failedCount: 0,
        },
        {
          code: "feature.lead-report-assistant.protocol_shape",
          outcome: "inconclusive",
          passedCount: 0,
          failedCount: 1,
        },
      ],
    );
  });
});
