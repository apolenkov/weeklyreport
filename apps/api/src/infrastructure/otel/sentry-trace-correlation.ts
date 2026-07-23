import { isSpanContextValid, trace } from "@opentelemetry/api";
import type { ErrorEvent } from "@sentry/nestjs";

/**
 * Error↔trace correlation (OpenSpec: correlate-errors-to-traces).
 *
 * Stamp the active OTel span's ids onto a Sentry error event so the Bugsink
 * error links to its Tempo trace. Correlation is by shared trace id — Bugsink
 * stores errors only; traces live in Tempo.
 *
 * Sentry v10 pre-fills `event.contexts.trace.trace_id` from its own propagation
 * scope (a random id when `tracesSampleRate` is 0 and OTel setup is skipped),
 * and `beforeSend` runs AFTER that. So this MUST override unconditionally when a
 * valid span is active — a set-if-absent would leave the random id in place and
 * silently break the Tempo pivot.
 *
 * No active (or valid) span — boot, background jobs, post-context-loss — returns
 * the event unchanged: the error is still reported, just without trace context.
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
