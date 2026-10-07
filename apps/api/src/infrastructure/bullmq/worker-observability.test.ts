import { AsyncLocalStorage } from "node:async_hooks";

import { propagation, SpanStatusCode, trace } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  captureJobTraceContext,
  extractTraceId,
  resolveCorrelationId,
  runInJobTraceContext,
} from "./worker-observability.js";

const exporter = new InMemorySpanExporter();

// A valid W3C traceparent standing in for the trace captured at enqueue time.
const ENQUEUE_TRACE_ID = "0af7651916cd43dd8448eb211c80319c";
const ENQUEUE_TRACEPARENT = `00-${ENQUEUE_TRACE_ID}-b7ad6b7169203331-01`;

beforeAll(() => {
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(
    new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    }),
  );
});

beforeEach(() => {
  exporter.reset();
});

afterAll(() => {
  propagation.disable();
  trace.disable();
});

describe("captureJobTraceContext", () => {
  it("omits fields absent at enqueue time (no active span, no correlationId)", () => {
    expect(captureJobTraceContext()).toEqual({});
  });

  it("carries the correlationId supplied by the enqueuer", () => {
    expect(captureJobTraceContext("corr-1")).toEqual({
      correlationId: "corr-1",
    });
  });
});

describe("extractTraceId", () => {
  it("parses the trace id out of a captured traceparent", () => {
    expect(extractTraceId({ traceparent: ENQUEUE_TRACEPARENT })).toBe(
      ENQUEUE_TRACE_ID,
    );
  });

  it("returns undefined when no traceparent was captured", () => {
    expect(extractTraceId({})).toBeUndefined();
  });

  it("returns undefined for a malformed traceparent", () => {
    expect(
      extractTraceId({ traceparent: "not-a-traceparent" }),
    ).toBeUndefined();
  });

  it("rejects a trace id that is not exactly 32 hex chars", () => {
    expect(
      extractTraceId({ traceparent: "00-abc-b7ad6b7169203331-01" }),
    ).toBeUndefined();
  });

  it("rejects a 32-char trace id that is not hexadecimal", () => {
    expect(
      extractTraceId({
        traceparent: `00-${"z".repeat(32)}-b7ad6b7169203331-01`,
      }),
    ).toBeUndefined();
  });

  it("accepts an uppercase-hex trace id of the correct length", () => {
    const traceId = "0AF7651916CD43DD8448EB211C80319C";
    expect(
      extractTraceId({
        traceparent: `00-${traceId}-b7ad6b7169203331-01`,
      }),
    ).toBe(traceId);
  });
});

class AsyncLocalCls {
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

describe("resolveCorrelationId", () => {
  it("returns the active scope's correlation id", () => {
    const cls = new AsyncLocalCls();

    const resolved = cls.run(() => {
      cls.set("correlationId", "corr-active");
      return resolveCorrelationId(cls);
    });

    expect(resolved).toBe("corr-active");
  });

  it("returns undefined outside a scope or when the key is unset", () => {
    const cls = new AsyncLocalCls();

    expect(resolveCorrelationId(cls)).toBeUndefined();
    expect(cls.run(() => resolveCorrelationId(cls))).toBeUndefined();
    expect(resolveCorrelationId(null)).toBeUndefined();
  });
});

describe("runInJobTraceContext", () => {
  it("links the worker span to the enqueue trace", async () => {
    await runInJobTraceContext(
      { traceparent: ENQUEUE_TRACEPARENT },
      "worker.process",
      null,
      async () => Promise.resolve(),
    );

    const span = exporter
      .getFinishedSpans()
      .find((s) => s.name === "worker.process");
    expect(span).toBeDefined();
    expect(span?.spanContext().traceId).toBe(ENQUEUE_TRACE_ID);
    expect(span?.links).toHaveLength(1);
    expect(span?.links[0]?.context.traceId).toBe(ENQUEUE_TRACE_ID);
  });

  it("marks the worker span ERROR and rethrows the original rejection", async () => {
    const failure = new Error("job body exploded");

    await expect(
      runInJobTraceContext({}, "worker.process", null, () =>
        Promise.reject(failure),
      ),
    ).rejects.toBe(failure);

    const spans = exporter
      .getFinishedSpans()
      .filter((s) => s.name === "worker.process");
    expect(spans).toHaveLength(1);
    expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR);
    expect(spans[0]?.status.message).toBeUndefined();
  });

  it("leaves a successful worker span without an ERROR status", async () => {
    await runInJobTraceContext({}, "worker.process", null, async () =>
      Promise.resolve(),
    );

    const span = exporter
      .getFinishedSpans()
      .find((s) => s.name === "worker.process");
    expect(span?.status.code).not.toBe(SpanStatusCode.ERROR);
  });

  it("starts an unlinked span when no enqueue trace was captured", async () => {
    await runInJobTraceContext({}, "worker.process", null, async () =>
      Promise.resolve(),
    );

    const span = exporter
      .getFinishedSpans()
      .find((s) => s.name === "worker.process");
    expect(span?.links).toHaveLength(0);
  });

  it("isolates concurrent CLS scopes seeded from each job", async () => {
    const cls = new AsyncLocalCls();
    const secondStarted = Promise.withResolvers<void>();
    const firstSeen = vi.fn();
    const secondSeen = vi.fn();

    await Promise.all([
      runInJobTraceContext(
        { correlationId: "corr-first" },
        "worker.process",
        cls,
        async () => {
          await secondStarted.promise;
          firstSeen(cls.get("correlationId"));
        },
      ),
      runInJobTraceContext(
        { correlationId: "corr-second" },
        "worker.process",
        cls,
        async () => {
          secondStarted.resolve();
          await Promise.resolve();
          secondSeen(cls.get("correlationId"));
        },
      ),
    ]);

    expect(firstSeen).toHaveBeenCalledExactlyOnceWith("corr-first");
    expect(secondSeen).toHaveBeenCalledExactlyOnceWith("corr-second");
    expect(cls.isActive()).toBe(false);
  });

  it("creates an empty CLS scope without a correlation id", async () => {
    const cls = new AsyncLocalCls();
    const runWith = vi.spyOn(cls, "runWith");

    await runInJobTraceContext({}, "worker.process", cls, async () =>
      Promise.resolve(),
    );

    expect(runWith).toHaveBeenCalledExactlyOnceWith({}, expect.any(Function));
    runWith.mockRestore();
  });

  it("replaces an ambient CLS store for a carrier-less job and restores it afterward", async () => {
    const cls = new AsyncLocalCls();

    await cls.run(async () => {
      cls.set("correlationId", "corr-unrelated");

      await runInJobTraceContext({}, "worker.process", cls, () => {
        expect(cls.get("correlationId")).toBeUndefined();
        return Promise.resolve();
      });

      expect(cls.get("correlationId")).toBe("corr-unrelated");
    });

    expect(cls.isActive()).toBe(false);
  });
});
