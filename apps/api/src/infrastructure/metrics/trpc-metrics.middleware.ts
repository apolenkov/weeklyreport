import { type Span, trace } from "@opentelemetry/api";
import type { TRPCError } from "@trpc/server";

import {
  trpcRequestDurationSeconds,
  trpcRequestTotal,
} from "./metrics.registry.js";

// Opaque result pass-through so callers keep branded MiddlewareResult markers
// without this module mirroring tRPC's internal types.
export type TrpcMiddlewareResult<T = unknown> =
  ({ ok: true; data: unknown } & T) | ({ ok: false; error: TRPCError } & T);

interface TrpcMiddlewareArgs<R extends TrpcMiddlewareResult> {
  path: string;
  type: "query" | "mutation" | "subscription";
  next: () => Promise<R>;
}

// The tracer surface this middleware consumes; narrow so tests inject a
// double without erasing OTel's Span/Tracer types.
export interface SpanStarter {
  startActiveSpan<F extends (span: Span) => unknown>(
    name: string,
    fn: F,
  ): ReturnType<F>;
}

const DEFAULT_TRACER = trace.getTracer("customreport-api");

// The timer starts before next() and ends after it, so nested canonical
// logging/audit work executed inside next() is included in the measurement.
// Labels stay low-cardinality (path/type/outcome only) — correlationId/userId/
// IP would explode Prometheus series. try/catch is defense-in-depth for rare
// raw throws.
export async function trpcMetricsMiddleware<R extends TrpcMiddlewareResult>(
  opts: TrpcMiddlewareArgs<R>,
  tracer: SpanStarter = DEFAULT_TRACER,
): Promise<R> {
  const { path, type, next } = opts;
  const labels = { procedure: path, type };
  const endTimer = trpcRequestDurationSeconds.startTimer(labels);

  return tracer.startActiveSpan(path, async (span) => {
    span.setAttribute("type", type);
    try {
      const result = await next();
      const status = result.ok ? "success" : "error";
      span.setAttribute("status", status);
      endTimer({ ...labels, status });
      trpcRequestTotal.inc({ ...labels, status });
      span.end();
      return result;
    } catch (error) {
      span.setAttribute("status", "error");
      endTimer({ ...labels, status: "error" });
      trpcRequestTotal.inc({ ...labels, status: "error" });
      span.end();
      throw error;
    }
  });
}
