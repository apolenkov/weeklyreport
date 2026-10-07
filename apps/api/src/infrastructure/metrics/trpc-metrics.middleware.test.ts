import { type Span, SpanStatusCode } from "@opentelemetry/api";
import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  metricsRegistry,
  trpcRequestDurationSeconds,
  trpcRequestTotal,
} from "./metrics.registry.js";
import {
  type SpanStarter,
  trpcMetricsMiddleware,
} from "./trpc-metrics.middleware.js";

function installSpanSpy(): {
  span: Pick<Span, "end" | "setAttribute" | "setStatus">;
  startActiveSpan: ReturnType<typeof vi.fn>;
  tracer: SpanStarter;
} {
  const span = {
    setAttribute: vi.fn().mockReturnThis(),
    setStatus: vi.fn().mockReturnThis(),
    end: vi.fn(),
  };
  const startActiveSpan = vi.fn(
    (_name: string, fn: (activeSpan: Span) => unknown) =>
      fn(span as unknown as Span),
  );
  const tracer: SpanStarter = {
    startActiveSpan: startActiveSpan as SpanStarter["startActiveSpan"],
  };
  return { span, startActiveSpan, tracer };
}

describe("trpcMetricsMiddleware", () => {
  beforeEach(() => {
    // Client samples are global per registry; reset between tests so
    // counter assertions don't bleed across test cases. Mirrors the pattern
    // used by metrics.registry.test.ts.
    metricsRegistry.resetMetrics();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function invoke(
    path: string,
    type: "query" | "mutation",
    nextResult:
      | { ok: true; data: unknown }
      | { ok: false; error: TRPCError }
      | { throws: Error },
    tracer: SpanStarter,
  ) {
    return trpcMetricsMiddleware(
      {
        path,
        type,
        next: () => {
          if ("throws" in nextResult) return Promise.reject(nextResult.throws);
          return Promise.resolve(nextResult);
        },
      },
      tracer,
    );
  }

  it("records a success label set for a passing query", async () => {
    const { span, startActiveSpan, tracer } = installSpanSpy();
    await invoke(
      "admin.snapshot",
      "query",
      { ok: true, data: { rows: 0 } },
      tracer,
    );
    await invoke(
      "admin.snapshot",
      "query",
      { ok: true, data: { rows: 0 } },
      tracer,
    );

    const counter = metricsRegistry.getSingleMetric("trpc_request_total");
    expect(counter).toBeDefined();
    const text = await metricsRegistry.metrics();

    expect(text).toContain(
      'trpc_request_total{procedure="admin.snapshot",type="query",status="success"} 2',
    );
    expect(text).toContain(
      'trpc_request_duration_seconds_count{procedure="admin.snapshot",type="query",status="success"} 2',
    );
    expect(startActiveSpan).toHaveBeenCalledTimes(2);
    expect(startActiveSpan.mock.calls[0]?.[0]).toBe("admin.snapshot");
    expect(span.setAttribute).toHaveBeenCalledWith("type", "query");
    expect(span.setAttribute).toHaveBeenCalledWith("status", "success");
    expect(span.setStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: SpanStatusCode.ERROR }),
    );
    expect(span.end).toHaveBeenCalledTimes(2);
  });

  it("records an error label when the inner middleware returns ok=false", async () => {
    const { span, startActiveSpan, tracer } = installSpanSpy();
    await invoke(
      "admin.snapshot",
      "mutation",
      {
        ok: false,
        error: new TRPCError({ code: "FORBIDDEN", message: "denied" }),
      },
      tracer,
    );

    const text = await metricsRegistry.metrics();
    expect(text).toContain(
      'trpc_request_total{procedure="admin.snapshot",type="mutation",status="error"} 1',
    );
    expect(text).toContain(
      'trpc_request_duration_seconds_count{procedure="admin.snapshot",type="mutation",status="error"} 1',
    );
    expect(startActiveSpan).toHaveBeenCalledExactlyOnceWith(
      "admin.snapshot",
      expect.any(Function),
    );
    expect(span.setAttribute).toHaveBeenCalledWith("type", "mutation");
    expect(span.setAttribute).toHaveBeenCalledWith("status", "error");
    // The standard span status marks the error envelope as a failure in
    // trace-only analysis; the custom label stays the metrics dimension.
    expect(span.setStatus).toHaveBeenCalledExactlyOnceWith({
      code: SpanStatusCode.ERROR,
    });
    expect(span.end).toHaveBeenCalledOnce();
  });

  it("records an error label and rethrows when inner next() throws", async () => {
    const thrown = new Error("boom");
    const { span, tracer } = installSpanSpy();
    await expect(
      invoke("weeklyReport.get", "query", { throws: thrown }, tracer),
    ).rejects.toBe(thrown);

    const text = await metricsRegistry.metrics();
    expect(text).toContain(
      'trpc_request_total{procedure="weeklyReport.get",type="query",status="error"} 1',
    );
    // A raw throw produces the same standard ERROR status as an error
    // envelope, with no exception detail copied into the status.
    expect(span.setStatus).toHaveBeenCalledExactlyOnceWith({
      code: SpanStatusCode.ERROR,
    });
    expect(span.end).toHaveBeenCalledOnce();
  });

  it("starts a histogram timer that records a duration observation", async () => {
    // Presence of the labelled sum series proves the timer fired; observed
    // duration is always >= 0 so a numeric floor assert would be vacuous.
    const { tracer } = installSpanSpy();
    await invoke(
      "analytics.leadVelocity",
      "query",
      { ok: true, data: { rows: [] } },
      tracer,
    );
    const histogram = metricsRegistry.getSingleMetric(
      "trpc_request_duration_seconds",
    );
    expect(histogram).toBe(trpcRequestDurationSeconds);

    const text = await metricsRegistry.metrics();
    const sumLine = text
      .split("\n")
      .find(
        (l) =>
          l.startsWith("trpc_request_duration_seconds_sum{") &&
          l.includes('procedure="analytics.leadVelocity"'),
      );
    expect(sumLine).toBeDefined();
    // sanity: the counter handle is the singleton we exported, not a stray
    // double-register.
    expect(metricsRegistry.getSingleMetric("trpc_request_total")).toBe(
      trpcRequestTotal,
    );
  });
});
