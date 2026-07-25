import { isSpanContextValid, trace } from "@opentelemetry/api";
import type { ErrorEvent } from "@sentry/nestjs";

// Sentry v10 pre-fills contexts.trace with a random id before beforeSend; must
// override unconditionally when a valid OTel span is active, or the Tempo pivot
// silently breaks. No active span → event unchanged (error still reported).
/**
 * Stamp Active Trace.
 * @param event - The event argument.
 */
export function stampActiveTrace(event: ErrorEvent): ErrorEvent {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (!spanContext || !isSpanContextValid(spanContext)) {
    return event;
  }
  // Return a copy — Sentry beforeSend accepts either; avoid mutating the caller.
  return {
    ...event,
    contexts: {
      ...event.contexts,
      trace: {
        ...event.contexts?.trace,
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
      },
    },
  };
}
