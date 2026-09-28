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
const SENTRY_TRACE_ID = "ffffffffffffffffffffffffffffffff";
const SENTRY_SPAN_ID = "ffffffffffffffff";

function spanWith(spanContext: SpanContext): Span {
  return { spanContext: () => spanContext } as Span;
}

function activeSpan(): Span {
  return spanWith({
    traceId: VALID_TRACE_ID,
    spanId: VALID_SPAN_ID,
    traceFlags: TraceFlags.SAMPLED,
  });
}

describe("stampActiveTrace", () => {
  beforeEach(() => {
    getActiveSpan.mockReset();
  });

  describe("without a valid active span", () => {
    it("removes a pre-filled trace context without mutating the input", () => {
      getActiveSpan.mockReturnValue(undefined);
      const event: ErrorEvent = {
        type: undefined,
        message: "boom",
        contexts: {
          trace: { trace_id: SENTRY_TRACE_ID, span_id: SENTRY_SPAN_ID },
        },
      };
      const original = structuredClone(event);

      const out = stampActiveTrace(event);

      expect(out).not.toBe(event);
      expect(out.message).toBe("boom");
      expect(out.contexts).not.toHaveProperty("trace");
      // The input keeps its pre-filled context untouched.
      expect(event).toEqual(original);
    });

    it("keeps contexts absent when the event has none", () => {
      getActiveSpan.mockReturnValue(undefined);
      const event: ErrorEvent = { type: undefined };

      const out = stampActiveTrace(event);

      expect(out).not.toBe(event);
      // Absence, not a `contexts: undefined` property.
      expect("contexts" in out).toBe(false);
    });

    it("preserves other contexts while dropping trace", () => {
      getActiveSpan.mockReturnValue(undefined);
      const event: ErrorEvent = {
        type: undefined,
        contexts: {
          trace: { trace_id: SENTRY_TRACE_ID, span_id: SENTRY_SPAN_ID },
          runtime: { name: "node" },
          os: { name: "macos", version: "15.0" },
        },
      };

      const out = stampActiveTrace(event);

      expect(out.contexts).not.toHaveProperty("trace");
      expect(out.contexts?.runtime).toEqual({ name: "node" });
      expect(out.contexts?.os).toEqual({ name: "macos", version: "15.0" });
    });

    it("removes a pre-filled trace context when the span context is invalid", () => {
      getActiveSpan.mockReturnValue(
        spanWith({
          traceId: "00000000000000000000000000000000",
          spanId: "0000000000000000",
          traceFlags: TraceFlags.NONE,
        }),
      );
      const event: ErrorEvent = {
        type: undefined,
        contexts: {
          trace: { trace_id: SENTRY_TRACE_ID, span_id: SENTRY_SPAN_ID },
        },
      };

      const out = stampActiveTrace(event);

      expect(out.contexts).not.toHaveProperty("trace");
    });
  });

  describe("with a valid active span", () => {
    it("overrides trace ids while preserving extra trace fields and other contexts", () => {
      getActiveSpan.mockReturnValue(activeSpan());
      // Sentry pre-fills contexts.trace with its own random id before beforeSend.
      const event: ErrorEvent = {
        type: undefined,
        contexts: {
          trace: {
            trace_id: SENTRY_TRACE_ID,
            span_id: SENTRY_SPAN_ID,
            op: "http.server",
            parent_span_id: "1111111111111111",
          },
          runtime: { name: "node" },
        },
      };

      const out = stampActiveTrace(event);

      expect(out.contexts?.trace?.trace_id).toBe(VALID_TRACE_ID);
      expect(out.contexts?.trace?.span_id).toBe(VALID_SPAN_ID);
      expect(out.contexts?.trace).toMatchObject({
        op: "http.server",
        parent_span_id: "1111111111111111",
      });
      expect(out.contexts?.runtime).toEqual({ name: "node" });
      // The input's random trace id is untouched.
      expect(event.contexts?.trace?.trace_id).toBe(SENTRY_TRACE_ID);
    });

    it("creates a trace context when the event has none", () => {
      getActiveSpan.mockReturnValue(activeSpan());
      const event: ErrorEvent = { type: undefined };

      const out = stampActiveTrace(event);

      expect(out.contexts?.trace?.trace_id).toBe(VALID_TRACE_ID);
      expect(out.contexts?.trace?.span_id).toBe(VALID_SPAN_ID);
    });
  });
});
