import { isSpanContextValid, trace } from "@opentelemetry/api";
import type { ErrorEvent } from "@sentry/nestjs";

// A valid active OTel span must override Sentry's own trace context, or the
// Tempo pivot silently breaks. No active span → event unchanged (still reported).
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
