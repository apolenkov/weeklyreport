import * as Sentry from "@sentry/nestjs";
import type { Job, Processor } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const workerState = vi.hoisted(() => ({
  processor: undefined as Processor | undefined,
  worker: undefined as
    | {
        emit: (event: string, ...args: unknown[]) => void;
      }
    | undefined,
}));

vi.mock("@sentry/nestjs", () => ({ captureException: vi.fn() }));
vi.mock("bullmq", () => ({
  Worker: class {
    private readonly listeners = new Map<
      string,
      ((...args: unknown[]) => void)[]
    >();
    private running = true;
    private paused = false;

    constructor(_queue: string, processor: Processor) {
      workerState.processor = processor;
      workerState.worker = this;
    }

    on(event: string, listener: (...args: unknown[]) => void): this {
      const listeners = this.listeners.get(event) ?? [];
      listeners.push(listener);
      this.listeners.set(event, listeners);
      return this;
    }
    emit(event: string, ...args: unknown[]): void {
      for (const listener of this.listeners.get(event) ?? []) listener(...args);
    }
    isRunning(): boolean {
      return this.running;
    }
    isPaused(): boolean {
      return this.paused;
    }
    waitUntilReady(): Promise<Record<string, never>> {
      return Promise.resolve({});
    }
    close(): Promise<void> {
      this.running = false;
      this.emit("closed");
      return Promise.resolve();
    }
  },
}));
vi.mock("./bullmq-options", () => ({ getBullMQOptions: () => ({}) }));

import { RawBullMqProcessor } from "./raw-bullmq-processor.js";
import { WorkerLivenessRegistry } from "./worker-liveness.registry.js";
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
    workerState.worker = undefined;
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

  it("publishes worker ready, connection-error, recovery, and stopped lifecycle", async () => {
    const registry = new WorkerLivenessRegistry();
    const logger = { error: vi.fn() };
    const processor = new FailingProcessor(
      {} as never,
      logger as never,
      null,
      registry,
    );

    processor.onModuleInit();
    expect(registry.requiredWorkers()).toMatchObject({
      ready: false,
      workers: { "pdf-export": "starting" },
    });

    workerState.worker?.emit("ready");
    expect(registry.requiredWorkers().workers["pdf-export"]).toBe("ready");

    workerState.worker?.emit("error", new Error("Redis disconnected"));
    expect(registry.requiredWorkers().workers["pdf-export"]).toBe("unready");
    expect(logger.error).toHaveBeenCalledWith(
      "BullMQ worker connection error",
      { queueName: "pdf-export", message: "Redis disconnected" },
    );

    workerState.worker?.emit("ready");
    expect(registry.requiredWorkers().workers["pdf-export"]).toBe("ready");

    await processor.onModuleDestroy();
    expect(registry.requiredWorkers().workers["pdf-export"]).toBe("stopped");
    workerState.worker?.emit("ready");
    expect(registry.requiredWorkers().workers["pdf-export"]).toBe("stopped");
  });
});
