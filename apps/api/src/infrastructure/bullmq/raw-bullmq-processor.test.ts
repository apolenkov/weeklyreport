import * as Sentry from "@sentry/nestjs";
import type { Job, Processor } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const workerState = vi.hoisted(() => ({
  processor: undefined as Processor | undefined,
}));

vi.mock("@sentry/nestjs", () => ({ captureException: vi.fn() }));
vi.mock("bullmq", () => ({
  Worker: class {
    constructor(_queue: string, processor: Processor) {
      workerState.processor = processor;
    }

    on(): this {
      return this;
    }
    close(): Promise<void> {
      return Promise.resolve();
    }
  },
}));
vi.mock("./bullmq-options", () => ({ getBullMQOptions: () => ({}) }));

import { RawBullMqProcessor } from "./raw-bullmq-processor.js";
import type { JobTraceContext } from "./worker-observability.js";

class FailingProcessor extends RawBullMqProcessor<JobTraceContext> {
  protected readonly queueName = "pdf-export";
  protected readonly spanName = "test.process";
  protected readonly processJob = vi.fn(() =>
    Promise.reject(new Error("boom")),
  );
  protected readonly onJobFailed = vi.fn();
}

describe("RawBullMqProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workerState.processor = undefined;
  });

  it("captures a processing error before the worker trace context closes", async () => {
    const processor = new FailingProcessor({} as never, {} as never, null);
    processor.onModuleInit();
    const run = workerState.processor;
    const error = new Error("boom");
    vi.mocked(
      (processor as unknown as { processJob: ReturnType<typeof vi.fn> })
        .processJob,
    ).mockRejectedValueOnce(error);

    await expect(
      run?.({ data: {} } as Job<JobTraceContext>, "token"),
    ).rejects.toBe(error);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
