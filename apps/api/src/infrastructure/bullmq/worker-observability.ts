import { context, propagation, trace } from "@opentelemetry/api";
import type { ClsService } from "nestjs-cls";

import { type AppLogger, createAppLogger } from "../../lib/logger.js";
import { validateEnv } from "../config/env.schema.js";

const CORRELATION_ID_KEY = "correlationId";
const WORKER_TRACER_NAME = "customreport-bullmq";

// Trace/correlation threaded into a BullMQ job so the worker re-links to the
// enqueue trace. Fields omitted (never written as undefined) when no trace is
// active or the enqueuer is outside a request scope.
export interface JobTraceContext {
  readonly traceparent?: string;
  readonly tracestate?: string;
  readonly correlationId?: string;
}

// The CLS surface workers actually use; ClsService is nominal (private `als`),
// so declaring the consumed members lets tests inject a real AsyncLocalStorage
// double without an erasing cast.
export interface JobCls {
  isActive(): boolean;
  get(key: string): unknown;
  run<T>(fn: () => T): T;
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

// Link the job body to its enqueue trace and seed CLS with the enqueue
// correlationId so job logs share the request's trace/correlation context.
export async function runInJobTraceContext(
  jobContext: JobTraceContext,
  spanName: string,
  cls: JobCls | null,
  body: () => Promise<void>,
): Promise<void> {
  const parent = propagation.extract(context.active(), {
    ...(jobContext.traceparent ? { traceparent: jobContext.traceparent } : {}),
    ...(jobContext.tracestate ? { tracestate: jobContext.tracestate } : {}),
  });
  const parentSpanContext = trace.getSpanContext(parent);
  const span = trace.getTracer(WORKER_TRACER_NAME).startSpan(spanName, {
    links: parentSpanContext ? [{ context: parentSpanContext }] : [],
  });

  const runSpan = async (): Promise<void> => {
    try {
      await context.with(trace.setSpan(context.active(), span), body);
    } finally {
      span.end();
    }
  };

  const { correlationId } = jobContext;
  if (cls && correlationId !== undefined) {
    await cls.run(async () => {
      cls.set(CORRELATION_ID_KEY, correlationId);
      await runSpan();
    });
    return;
  }
  await runSpan();
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

// Workers sit outside main.ts's request pipeline; seed with the same CLS so
// job-scoped logs resolve correlationId like in-request logs.
export function createWorkerLogger(
  service: string,
  cls: ClsService,
): AppLogger {
  const env = validateEnv();
  return createAppLogger({
    service,
    minLevel: env.LOG_LEVEL,
    ...(env.LOG_DIR ? { logDir: env.LOG_DIR } : {}),
    clsService: cls,
  });
}
