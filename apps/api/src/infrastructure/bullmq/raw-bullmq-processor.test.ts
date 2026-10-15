import { AsyncLocalStorage } from "node:async_hooks";

import { context, propagation, trace } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import * as Sentry from "@sentry/nestjs";
import type { Job, Processor } from "bullmq";
import type { ClsService } from "nestjs-cls";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const workerState = vi.hoisted(() => ({
  processor: undefined as Processor | undefined,
  worker: undefined as
    | {
        emit: (event: string, ...args: unknown[]) => void;
        close: (force?: boolean) => Promise<void>;
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
    close(_force = false): Promise<void> {
      this.running = false;
      this.emit("closed");
      return Promise.resolve();
    }
  },
}));
vi.mock("./bullmq-options", () => ({ getBullMQOptions: () => ({}) }));

import { createAppLogger } from "../../lib/logger.js";
import { RawBullMqProcessor } from "./raw-bullmq-processor.js";
import { WorkerLivenessRegistry } from "./worker-liveness.registry.js";
import type { JobCls, JobTraceContext } from "./worker-observability.js";

const ENQUEUE_TRACE_ID = "0af7651916cd43dd8448eb211c80319c";
const ENQUEUE_TRACEPARENT = `00-${ENQUEUE_TRACE_ID}-b7ad6b7169203331-01`;
const exporter = new InMemorySpanExporter();
const otelSdk = new NodeSDK({
  autoDetectResources: false,
  instrumentations: [],
  logRecordProcessors: [],
  metricReaders: [],
  spanProcessors: [new SimpleSpanProcessor(exporter)],
  textMapPropagator: new W3CTraceContextPropagator(),
});

beforeAll(() => {
  otelSdk.start();
});

afterAll(async () => {
  await otelSdk.shutdown();
  context.disable();
  propagation.disable();
  trace.disable();
});

class AsyncLocalCls implements JobCls {
  private readonly storage = new AsyncLocalStorage<Record<string, unknown>>();

  run<T>(fn: () => T): T {
    return this.storage.run({ ...this.storage.getStore() }, fn);
  }

  runWith<T>(store: Record<string, unknown>, fn: () => T): T {
    return this.storage.run({ ...store }, fn);
  }

  set(key: string, value: unknown): void {
    const store = this.storage.getStore();
    if (store) store[key] = value;
  }

  get(key: string): unknown {
    return this.storage.getStore()?.[key];
  }

  isActive(): boolean {
    return this.storage.getStore() !== undefined;
  }
}

class FailingProcessor extends RawBullMqProcessor<JobTraceContext> {
  protected readonly queueName = "pdf-export";
  protected readonly spanName = "test.process";
  protected readonly processJob = vi.fn(() =>
    Promise.reject(new Error("boom")),
  );
  protected readonly onJobFailed = vi.fn();
}

class LoggingFailingProcessor extends RawBullMqProcessor<JobTraceContext> {
  protected readonly queueName = "pdf-export";
  protected readonly spanName = "test.process";
  protected readonly processJob = vi.fn(() =>
    Promise.reject(new Error("boom")),
  );
  protected readonly onJobFailed = (
    _job: Job<JobTraceContext> | undefined,
    error: Error,
  ): void => {
    void Promise.resolve().then(() => {
      this.logger.error("test job failed", { error: error.message });
    });
  };
}

class HookGatedProcessor extends RawBullMqProcessor<JobTraceContext> {
  readonly hook = Promise.withResolvers<void>();
  protected readonly queueName = "pdf-export";
  protected readonly spanName = "test.process";
  protected readonly processJob = vi.fn(() => Promise.resolve());
  protected readonly onJobFailed = vi.fn(() => this.hook.promise);
}

describe("RawBullMqProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exporter.reset();
    workerState.processor = undefined;
    workerState.worker = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("restores trusted trace and correlation context for failed-event continuations", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const cls = new AsyncLocalCls();
    const logger = createAppLogger({
      minLevel: "debug",
      clsService: cls as unknown as ClsService,
    });
    const processor = new LoggingFailingProcessor(
      {} as never,
      logger,
      cls as unknown as ClsService,
    );
    const job = {
      data: {
        traceparent: ENQUEUE_TRACEPARENT,
        correlationId: "corr-failed-job",
      },
    } as Job<JobTraceContext>;

    processor.onModuleInit();
    await expect(workerState.processor?.(job, "token")).rejects.toThrow("boom");
    expect(cls.isActive()).toBe(false);
    expect(trace.getActiveSpan()).toBeUndefined();

    workerState.worker?.emit("failed", job, new Error("boom"));

    await vi.waitFor(() => {
      expect(stderr).toHaveBeenCalled();
    });
    const failureEntry = stderr.mock.calls
      .map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)
      .find((entry) => entry.message === "test job failed");
    expect(failureEntry).toMatchObject({
      correlationId: "corr-failed-job",
      traceId: ENQUEUE_TRACE_ID,
      error: "boom",
    });
    const failureSpan = exporter
      .getFinishedSpans()
      .find((span) => span.name === "test.process.failed");
    expect(failureSpan?.spanContext().traceId).toBe(ENQUEUE_TRACE_ID);
    expect(failureSpan?.links[0]?.context.traceId).toBe(ENQUEUE_TRACE_ID);

    logger.error("unrelated failure");
    const unrelatedEntry = stderr.mock.calls
      .map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)
      .find((entry) => entry.message === "unrelated failure");
    expect(unrelatedEntry).toMatchObject({ correlationId: "no-context" });
    expect(unrelatedEntry).not.toHaveProperty("traceId");

    await cls.run(async () => {
      cls.set("correlationId", "corr-unrelated");
      const unrelatedSpan = trace.getTracer("test").startSpan("unrelated");
      await context.with(trace.setSpan(context.active(), unrelatedSpan), () => {
        workerState.worker?.emit(
          "failed",
          { data: {} },
          new Error("carrier missing"),
        );
        return vi.waitFor(() => {
          const missingCarrierEntry = stderr.mock.calls
            .map(
              ([line]) => JSON.parse(String(line)) as Record<string, unknown>,
            )
            .find(
              (entry) =>
                entry.message === "test job failed" &&
                entry.error === "carrier missing",
            );
          expect(missingCarrierEntry?.correlationId).toBe("no-context");
          expect(missingCarrierEntry?.traceId).toMatch(/^[0-9a-f]{32}$/);
          expect(missingCarrierEntry?.traceId).not.toBe(
            unrelatedSpan.spanContext().traceId,
          );
        });
      });
      unrelatedSpan.end();
      expect(cls.get("correlationId")).toBe("corr-unrelated");
    });
    expect(cls.isActive()).toBe(false);

    stderr.mockRestore();
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

  it("logs a worker close rejection that settles after the graceful deadline", async () => {
    vi.useFakeTimers();
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const logger = createAppLogger({ minLevel: "debug" });
    const processor = new FailingProcessor({} as never, logger, null);
    processor.onModuleInit();
    const worker = workerState.worker;
    if (!worker) throw new Error("worker was not constructed");
    // BullMQ: close(true) after close() returns the pending close promise.
    const pendingClose = new Promise<void>((_resolve, reject) => {
      setTimeout(() => reject(new Error("close handshake failed")), 600);
    });
    worker.close = () => pendingClose;

    const destroyed = processor.onModuleDestroy();
    const settled = expect(destroyed).rejects.toThrow(
      "BullMQ worker force close failed",
    );
    await vi.advanceTimersByTimeAsync(1000);
    await settled;

    const closeEntries = stderr.mock.calls
      .map(([line]) => JSON.parse(String(line)) as Record<string, unknown>)
      .filter((entry) => entry.message === "BullMQ worker close failed");
    expect(closeEntries).toHaveLength(1);
    expect(closeEntries[0]).toMatchObject({
      level: "error",
      queueName: "pdf-export",
      error: "close handshake failed",
    });
    stderr.mockRestore();
  });

  it("keeps shutdown open until an in-flight failed-event hook settles", async () => {
    const processor = new HookGatedProcessor({} as never, {} as never, null);
    processor.onModuleInit();
    workerState.worker?.emit("failed", { data: {} }, new Error("boom"));

    let destroyed = false;
    const destroy = processor.onModuleDestroy().then(() => {
      destroyed = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(destroyed).toBe(false);

    processor.hook.resolve();
    await destroy;
    expect(destroyed).toBe(true);
  });

  it("still captures a rejecting failed-event hook and finishes shutdown", async () => {
    const processor = new HookGatedProcessor({} as never, {} as never, null);
    processor.onModuleInit();
    workerState.worker?.emit("failed", { data: {} }, new Error("boom"));
    const hookError = new Error("reconcile failed");
    processor.hook.reject(hookError);

    await processor.onModuleDestroy();
    expect(Sentry.captureException).toHaveBeenCalledWith(hookError);
  });

  it("stops waiting for a failed-event hook that never settles and logs it", async () => {
    vi.useFakeTimers();
    const logger = { error: vi.fn() };
    const processor = new HookGatedProcessor(
      {} as never,
      logger as never,
      null,
    );
    processor.onModuleInit();
    workerState.worker?.emit("failed", { data: {} }, new Error("boom"));

    const destroyed = processor.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(5000);
    await destroyed;

    expect(logger.error).toHaveBeenCalledWith(
      "BullMQ failed-event hook did not settle before shutdown",
      { queueName: "pdf-export", pending: 1 },
    );
  });
});
