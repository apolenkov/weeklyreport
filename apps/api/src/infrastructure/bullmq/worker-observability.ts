import {
  context,
  propagation,
  ROOT_CONTEXT,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";

import type { JobTraceContext } from "../../lib/job-trace-context.js";

const CORRELATION_ID_KEY = "correlationId";
const WORKER_TRACER_NAME = "customreport-bullmq";

// Trace/correlation threaded into a BullMQ job so the worker re-links to the
// enqueue trace. Fields omitted (never written as undefined) when no trace is
// active or the enqueuer is outside a request scope.
export type { JobTraceContext } from "../../lib/job-trace-context.js";

// The CLS surface workers actually use; ClsService is nominal (private `als`),
// so declaring the consumed members lets tests inject a real AsyncLocalStorage
// double without an erasing cast.
export interface JobCls {
  isActive(): boolean;
  get(key: string): unknown;
  runWith<T>(store: Record<string, unknown>, fn: () => T): T;
  set(key: string, value: unknown): void;
}

export function resolveCorrelationId(cls: JobCls | null): string | undefined {
  if (!cls?.isActive()) return undefined;
  const value: unknown = cls.get(CORRELATION_ID_KEY);
  return typeof value === "string" ? value : undefined;
}

// Capture W3C trace at queue.add via the global propagator; correlationId is
// supplied by the enqueuer (not injected).
export function captureJobTraceContext(
  correlationId?: string,
): JobTraceContext {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return {
    ...(carrier.traceparent ? { traceparent: carrier.traceparent } : {}),
    ...(carrier.tracestate ? { tracestate: carrier.tracestate } : {}),
    ...(correlationId ? { correlationId } : {}),
  };
}

// Redis payloads are untrusted: the Job<T> generic cannot prove the runtime
// shape, so a null or primitive job.data must not crash telemetry or the
// failure hooks that run after a malformed delivery. Only a non-null object's
// string field is ever read back.
export function jobDataStringField(
  data: unknown,
  key: string,
): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const value: unknown = (data as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

// The trace carrier is the same untrusted boundary: propagation.extract and
// failure logs only ever see string fields of a non-null object; anything
// else degrades to an empty carrier rather than throwing.
function jobTraceCarrier(data: unknown): JobTraceContext {
  const traceparent = jobDataStringField(data, "traceparent");
  const tracestate = jobDataStringField(data, "tracestate");
  const correlationId = jobDataStringField(data, "correlationId");
  return {
    ...(traceparent !== undefined ? { traceparent } : {}),
    ...(tracestate !== undefined ? { tracestate } : {}),
    ...(correlationId !== undefined ? { correlationId } : {}),
  };
}

// Link the job body to its enqueue trace and seed CLS with the enqueue
// correlationId so job logs share the request's trace/correlation context.
export async function runInJobTraceContext<T>(
  jobContext: unknown,
  spanName: string,
  cls: JobCls | null,
  body: () => Promise<T>,
): Promise<T> {
  const jobData = jobTraceCarrier(jobContext);
  const parent = propagation.extract(ROOT_CONTEXT, {
    ...(jobData.traceparent ? { traceparent: jobData.traceparent } : {}),
    ...(jobData.tracestate ? { tracestate: jobData.tracestate } : {}),
  });
  const parentSpanContext = trace.getSpanContext(parent);
  const span = trace.getTracer(WORKER_TRACER_NAME).startSpan(
    spanName,
    {
      links: parentSpanContext ? [{ context: parentSpanContext }] : [],
    },
    parent,
  );

  const runSpan = async (): Promise<T> => {
    try {
      return await context.with(trace.setSpan(parent, span), body);
    } catch (error: unknown) {
      // Mark the span ERROR so trace-only analysis sees the failure; the
      // Sentry capture inside the body stays the sole owner of the raw
      // exception, and no message/stack lands in span status.
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  };

  if (cls) {
    // BullMQ callbacks may arrive inside an unrelated request scope. Start every
    // job with an empty store so nestjs-cls cannot inherit that caller's fields.
    return cls.runWith({}, async () => {
      const { correlationId } = jobData;
      if (correlationId !== undefined) {
        cls.set(CORRELATION_ID_KEY, correlationId);
      }
      return runSpan();
    });
  }
  return runSpan();
}

const TRACEPARENT_SEGMENT_COUNT = 4;
// W3C trace ids are exactly 32 hex chars (16 bytes); shorter ids are malformed.
const TRACE_ID_HEX_RE = /^[0-9a-f]{32}$/i;

// Failure handler runs after the span ends, so ambient OTel no longer has the
// trace id — read it back from the job carrier. Strict on the trace id shape
// so a truncated or garbage id never surfaces as a real trace reference.
export function extractTraceId(ctx: JobTraceContext): string | undefined {
  const segments = ctx.traceparent?.split("-");
  if (segments?.length !== TRACEPARENT_SEGMENT_COUNT) return undefined;
  const traceId = segments[1];
  return traceId !== undefined && TRACE_ID_HEX_RE.test(traceId)
    ? traceId
    : undefined;
}

export function describeJobFailureTrace(data: unknown) {
  const ctx = jobTraceCarrier(data);
  const { correlationId, traceparent } = ctx;
  const traceId = extractTraceId(ctx);
  return {
    correlationId,
    traceparent,
    traceId,
    logFields: {
      ...(correlationId ? { correlationId } : {}),
      ...(traceId ? { traceId } : {}),
    },
  };
}
