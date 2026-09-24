import { isSpanContextValid, trace } from "@opentelemetry/api";
import type { ErrorEvent } from "@sentry/nestjs";

// A valid active OTel span must override Sentry's own trace context, or the
// Tempo pivot silently breaks. With no valid active span, Sentry's pre-filled
// contexts.trace would point at a nonexistent trace, so it is dropped; the
// error is still reported (without trace context).
export function stampActiveTrace(event: ErrorEvent): ErrorEvent {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (spanContext && isSpanContextValid(spanContext)) {
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

  if (!event.contexts) {
    return { ...event };
  }

  const { trace: _prefilledTrace, ...contexts } = event.contexts;
  return { ...event, contexts };
}
