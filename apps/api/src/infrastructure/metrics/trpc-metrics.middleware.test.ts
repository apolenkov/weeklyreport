import type { Span, Tracer } from "@opentelemetry/api";
import { trace } from "@opentelemetry/api";
import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  metricsRegistry,
  trpcRequestDurationSeconds,
  trpcRequestTotal,
} from "./metrics.registry.js";
import { trpcMetricsMiddleware } from "./trpc-metrics.middleware.js";

function installSpanSpy(): {
  span: Pick<Span, "end" | "setAttribute">;
  startActiveSpan: ReturnType<typeof vi.fn>;
} {
  const span = {
    setAttribute: vi.fn().mockReturnThis(),
    end: vi.fn(),
  };
  const startActiveSpan = vi.fn(
    (_name: string, callback: (activeSpan: Span) => unknown) =>
      callback(span as unknown as Span),
  );
  vi.spyOn(trace, "getTracer").mockReturnValue({
    startActiveSpan,
  } as unknown as Tracer);
  return { span, startActiveSpan };
}

/**
 * Verifies the tRPC Prometheus middleware emits the right labels and
 * increments both the histogram (`_count`) and the dedicated counter.
 */
describe("trpcMetricsMiddleware", () => {
  beforeEach(() => {
    // prom-client samples are global per registry; reset between tests so
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
  ) {
    return trpcMetricsMiddleware({
      path,
      type,
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async next middleware contract (no awaitable work in the stub)
      next: async () => {
        if ("throws" in nextResult) throw nextResult.throws;
        return nextResult;
      },
    });
  }

  it("records a success label set for a passing query", async () => {
    const { span, startActiveSpan } = installSpanSpy();
    await invoke("admin.snapshot", "query", { ok: true, data: { rows: 0 } });
    await invoke("admin.snapshot", "query", { ok: true, data: { rows: 0 } });

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
    expect(span.end).toHaveBeenCalledTimes(2);
  });

  it("records an error label when the inner middleware returns ok=false", async () => {
    const { span, startActiveSpan } = installSpanSpy();
    await invoke("admin.snapshot", "mutation", {
      ok: false,
      error: new TRPCError({ code: "FORBIDDEN", message: "denied" }),
    });

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
    expect(span.end).toHaveBeenCalledOnce();
  });

  it("records an error label and rethrows when inner next() throws", async () => {
    const thrown = new Error("boom");
    await expect(
      invoke("weeklyReport.get", "query", { throws: thrown }),
    ).rejects.toBe(thrown);

    const text = await metricsRegistry.metrics();
    expect(text).toContain(
      'trpc_request_total{procedure="weeklyReport.get",type="query",status="error"} 1',
    );
  });

  it("starts a histogram timer that records a duration observation", async () => {
    // Presence of the labelled sum series proves the timer fired; observed
    // duration is always >= 0 so a numeric floor assert would be vacuous.
    await invoke("analytics.leadVelocity", "query", {
      ok: true,
      data: { rows: [] },
    });
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
