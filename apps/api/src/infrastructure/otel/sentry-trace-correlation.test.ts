import type { Span, SpanContext } from "@opentelemetry/api";
import { TraceFlags } from "@opentelemetry/api";
import type { ErrorEvent } from "@sentry/nestjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getActiveSpan = vi.fn<() => Span | undefined>();

vi.mock("@opentelemetry/api", async (importActual) => {
  const actual = await importActual<typeof import("@opentelemetry/api")>();
  return {
    ...actual,
    trace: { ...actual.trace, getActiveSpan: () => getActiveSpan() },
  };
});

const { stampActiveTrace } = await import("./sentry-trace-correlation.js");

const VALID_TRACE_ID = "0af7651916cd43dd8448eb211c80319c";
const VALID_SPAN_ID = "b7ad6b7169203331";

function spanWith(spanContext: SpanContext): Span {
  return { spanContext: () => spanContext } as Span;
}

describe("correlate-errors-to-traces: stampActiveTrace", () => {
  beforeEach(() => {
    getActiveSpan.mockReset();
  });

  it("OVERRIDES a pre-filled random trace id with the active span's ids", () => {
    getActiveSpan.mockReturnValue(
      spanWith({
        traceId: VALID_TRACE_ID,
        spanId: VALID_SPAN_ID,
        traceFlags: TraceFlags.SAMPLED,
      }),
    );
    // Sentry pre-fills contexts.trace with its own random id before beforeSend.
    const event: ErrorEvent = {
      type: undefined,
      contexts: {
        trace: {
          trace_id: "ffffffffffffffffffffffffffffffff",
          span_id: "ffffffffffffffff",
        },
      },
    };

    const out = stampActiveTrace(event);

    expect(out.contexts?.trace?.trace_id).toBe(VALID_TRACE_ID);
    expect(out.contexts?.trace?.span_id).toBe(VALID_SPAN_ID);
  });

  it("stamps onto an event with no prior trace context", () => {
    getActiveSpan.mockReturnValue(
      spanWith({
        traceId: VALID_TRACE_ID,
        spanId: VALID_SPAN_ID,
        traceFlags: TraceFlags.SAMPLED,
      }),
    );
    const event: ErrorEvent = { type: undefined };

    const out = stampActiveTrace(event);

    expect(out.contexts?.trace?.trace_id).toBe(VALID_TRACE_ID);
    expect(out.contexts?.trace?.span_id).toBe(VALID_SPAN_ID);
  });

  it("leaves the event unchanged when there is no active span", () => {
    getActiveSpan.mockReturnValue(undefined);
    const event: ErrorEvent = {
      type: undefined,
      contexts: {
        trace: {
          trace_id: "ffffffffffffffffffffffffffffffff",
          span_id: "ffffffffffffffff",
        },
      },
    };

    const out = stampActiveTrace(event);

    expect(out.contexts?.trace?.trace_id).toBe(
      "ffffffffffffffffffffffffffffffff",
    );
  });

  it("leaves the event unchanged when the span context is invalid (all-zero id)", () => {
    getActiveSpan.mockReturnValue(
      spanWith({
        traceId: "00000000000000000000000000000000",
        spanId: "0000000000000000",
        traceFlags: TraceFlags.NONE,
      }),
    );
    const event: ErrorEvent = { type: undefined };

    const out = stampActiveTrace(event);

    expect(out.contexts?.trace).toBeUndefined();
  });
});
