import { defaultTextMapGetter, ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";

import { createTraceContextPropagator } from "./otel.bootstrap.js";

// Exercises the real CompositePropagator, not array-order inspection.
const W3C_TRACE_ID = "11111111111111111111111111111111";
const W3C_SPAN_ID = "1111111111111111";
const SENTRY_TRACE_ID = "22222222222222222222222222222222";
const SENTRY_SPAN_ID = "2222222222222222";

describe("createTraceContextPropagator precedence", () => {
  it("prefers W3C traceparent when both traceparent and sentry-trace are present", () => {
    const propagator = createTraceContextPropagator();
    const carrier: Record<string, string> = {
      traceparent: `00-${W3C_TRACE_ID}-${W3C_SPAN_ID}-01`,
      "sentry-trace": `${SENTRY_TRACE_ID}-${SENTRY_SPAN_ID}-1`,
    };

    const ctx = propagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter);

    expect(trace.getSpanContext(ctx)?.traceId).toBe(W3C_TRACE_ID);
  });

  it("adopts the sentry-trace id when traceparent is absent (browser bridge)", () => {
    const propagator = createTraceContextPropagator();
    const carrier: Record<string, string> = {
      "sentry-trace": `${SENTRY_TRACE_ID}-${SENTRY_SPAN_ID}-1`,
    };

    const ctx = propagator.extract(ROOT_CONTEXT, carrier, defaultTextMapGetter);

    expect(trace.getSpanContext(ctx)?.traceId).toBe(SENTRY_TRACE_ID);
  });

  it("advertises both traceparent and sentry-trace as injection fields", () => {
    const fields = createTraceContextPropagator().fields();
    expect(fields).toContain("traceparent");
    expect(fields).toContain("sentry-trace");
  });
});
