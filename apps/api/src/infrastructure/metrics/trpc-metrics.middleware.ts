import { trace } from "@opentelemetry/api";
import type { TRPCError } from "@trpc/server";

import {
  trpcRequestDurationSeconds,
  trpcRequestTotal,
} from "./metrics.registry.js";

/**
 * Minimal contract this middleware needs from the tRPC
 * middleware runner. We pass-through the result object opaquely so callers
 * can keep their fully-typed `MiddlewareResult<TContext>` (which carries
 * a branded `marker`) without us mirroring those internals here.
 */
export type TrpcMiddlewareResult<T = unknown> =
  ({ ok: true; data: unknown } & T) | ({ ok: false; error: TRPCError } & T);

interface TrpcMiddlewareArgs<R extends TrpcMiddlewareResult> {
  path: string;
  type: "query" | "mutation" | "subscription";
  next: () => Promise<R>;
}

/**
 * tRPC Prometheus middleware.
 *
 * Records request latency (`trpc_request_duration_seconds`) and volume
 * (`trpc_request_total`) per procedure, labeled by procedure path, tRPC
 * type (query | mutation | subscription) and outcome (success | error).
 *
 * Wired BEFORE the existing logging/audit middleware on every procedure
 * helper so timings exclude logger overhead. The
 * middleware is intentionally framework-agnostic: it accepts the tiny
 * tRPC middleware contract (`{ path, type, next }`) and works with both
 * `publicProcedure` and the role-gated procedures.
 *
 * Status resolution:
 * - `next()` returned `ok: true`         → status="success"
 * - `next()` returned `ok: false` (TRPCError) → status="error"
 * - `next()` threw an unexpected exception     → status="error" + rethrow
 *   (raw throws are extremely rare — tRPC's own middleware runner catches
 *   thrown errors and converts them into `result.ok=false`; the try/catch
 *   here is defense-in-depth for tRPC internals or middleware mistakes.)
 *
 * NB: this middleware never inspects input/output, only path/type/outcome.
 * High-cardinality labels (correlationId, userId, IP) would explode the
 * Prometheus time-series store and are deliberately NOT included.
 */
export async function trpcMetricsMiddleware<R extends TrpcMiddlewareResult>(
  opts: TrpcMiddlewareArgs<R>,
): Promise<R> {
  const { path, type, next } = opts;
  const labels = { procedure: path, type };
  const endTimer = trpcRequestDurationSeconds.startTimer(labels);

  return trace
    .getTracer("customreport-api")
    .startActiveSpan(path, async (span) => {
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
