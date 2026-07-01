import { context, propagation, trace } from "@opentelemetry/api";
import type { ClsService } from "nestjs-cls";

import {
  type AppLogger,
  createAppLogger,
  createNullLogger,
} from "../../lib/logger.js";
import { validateEnv } from "../config/env.schema.js";

const CORRELATION_ID_KEY = "correlationId";
const WORKER_TRACER_NAME = "customreport-bullmq";

/**
 * Trace/correlation context threaded from an enqueuer into a BullMQ job so the
 * worker can re-link its run to the trace that queued it. Both fields are
 * optional: they are omitted from the job payload when no trace is active or
 * the enqueuer runs outside a request scope (a cron tick), never written as
 * `undefined`.
 */
export interface JobTraceContext {
  traceparent?: string;
  tracestate?: string;
  correlationId?: string;
}

/** Read the correlationId from an active CLS scope, or undefined outside one. */
export function resolveCorrelationId(cls?: ClsService): string | undefined {
  if (!cls?.isActive()) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cls.get returns undefined when the key is unset despite the generic return type
  return cls.get<string>(CORRELATION_ID_KEY) ?? undefined;
}

/**
 * Capture the active W3C trace context plus the caller's correlationId at
 * `queue.add` time. The global propagator (registered in the OTel bootstrap)
 * injects `traceparent`; the correlationId is supplied by the enqueuer.
 */
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

/**
 * Run a job body linked to its enqueue trace and inside a CLS scope seeded with
 * the enqueue correlationId, so logs emitted during the job carry the same
 * trace/correlation context as the request that queued it.
 */
export async function runInJobTraceContext(
  jobContext: JobTraceContext,
  spanName: string,
  cls: ClsService | undefined,
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

/**
 * Pull the W3C trace id out of a job's captured `traceparent`
 * (`00-<traceId>-<spanId>-<flags>`). The failure handler runs after
 * `runInJobTraceContext` has already ended the span, so the ambient OTel
 * context no longer carries the trace id — reading it back from the job's
 * own carrier is the only link from a failure log to the enqueue trace.
 * Returns undefined when no traceparent was captured or it is malformed.
 */
export function extractTraceId(ctx: JobTraceContext): string | undefined {
  const segments = ctx.traceparent?.split("-");
  if (segments?.length !== 4) return undefined;
  const traceId = segments[1];
  return traceId.length > 0 ? traceId : undefined;
}

/**
 * Build a worker's AppLogger. Workers run outside the request pipeline that
 * main.ts wires, so each processor owns a logger seeded with the same CLS
 * service — job-scoped logs then resolve correlationId like in-request logs do.
 */
export function createWorkerLogger(
  service: string,
  cls?: ClsService,
): AppLogger {
  if (!cls) return createNullLogger();
  const env = validateEnv();
  return createAppLogger({
    service,
    minLevel: env.LOG_LEVEL,
    ...(env.LOG_DIR ? { logDir: env.LOG_DIR } : {}),
    clsService: cls,
  });
}
