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
});

describe("runInJobTraceContext", () => {
  it("links the worker span to the enqueue trace", async () => {
    await runInJobTraceContext(
      { traceparent: ENQUEUE_TRACEPARENT },
      "worker.process",
      undefined,
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
    await runInJobTraceContext({}, "worker.process", undefined, async () =>
      Promise.resolve(),
    );

    const span = exporter
      .getFinishedSpans()
      .find((s) => s.name === "worker.process");
    expect(span?.links).toHaveLength(0);
  });

  it("seeds a CLS scope with the enqueue correlationId for the job body", async () => {
    const store = new Map<string, unknown>();
    const cls = {
      run: (fn: () => Promise<void>) => fn(),
      set: (key: string, value: unknown) => store.set(key, value),
      get: (key: string) => store.get(key),
      isActive: () => true,
    };
    const seen = vi.fn();

    await runInJobTraceContext(
      { correlationId: "corr-42" },
      "worker.process",
      cls as never,
      async () => {
        seen(cls.get("correlationId"));
        return Promise.resolve();
      },
    );

    expect(seen).toHaveBeenCalledWith("corr-42");
  });
});
