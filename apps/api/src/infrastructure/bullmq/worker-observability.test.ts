import { AsyncLocalStorage } from "node:async_hooks";

import { propagation, trace } from "@opentelemetry/api";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
  private readonly storage = new AsyncLocalStorage<Map<string, unknown>>();

  run<T>(fn: () => T): T {
    return this.storage.run(new Map(), fn);
  }

  set(key: string, value: unknown): void {
    this.storage.getStore()?.set(key, value);
  }

  get(key: string): unknown {
    return this.storage.getStore()?.get(key);
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
    expect(span?.links).toHaveLength(1);
    expect(span?.links[0]?.context.traceId).toBe(ENQUEUE_TRACE_ID);
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

  it("does not create a CLS scope without a correlation id", async () => {
    const run = vi.fn();

    await runInJobTraceContext(
      {},
      "worker.process",
      {
        isActive: () => false,
        get: () => undefined,
        run,
        set: () => undefined,
      },
      async () => Promise.resolve(),
    );

    expect(run).not.toHaveBeenCalled();
  });
});
