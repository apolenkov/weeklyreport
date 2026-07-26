import type { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../lib/logger.js";
import { httpRequestDurationSeconds } from "../metrics/metrics.registry.js";
import { recordTrpcFailure, type TrpcCallIdentity } from "./trpc.logging.js";

const IDENTITY: TrpcCallIdentity = {
  procedure: "reports.list",
  type: "query",
  userId: null,
  role: null,
};

const silentLogger: AppLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => silentLogger,
};

// recordTrpcFailure only reads code/message/cause, so a literal stands in for
// TRPCError — its constructor rejects the unknown-code fallback case.
const asTrpcError = (code: string): TRPCError =>
  ({ code, message: `stub ${code}` }) as unknown as TRPCError;

function observedStatusCode(code: string): unknown {
  const observe = vi.spyOn(httpRequestDurationSeconds, "observe");
  recordTrpcFailure(silentLogger, IDENTITY, 12, asTrpcError(code));
  const [labels] = observe.mock.calls[0] ?? [];
  return (labels as Record<string, unknown> | undefined)?.status_code;
}

afterEach(() => {
  vi.restoreAllMocks();
});

// Dashboards group on status_code, so every label is pinned against tRPC's own
// status table — a dependency bump must not silently move a series.
describe("recordTrpcFailure status_code label — application codes", () => {
  it.each([
    ["BAD_REQUEST", "400"],
    ["UNAUTHORIZED", "401"],
    ["FORBIDDEN", "403"],
    ["NOT_FOUND", "404"],
    ["METHOD_NOT_SUPPORTED", "405"],
    ["TIMEOUT", "408"],
    ["CONFLICT", "409"],
    ["PRECONDITION_FAILED", "412"],
    ["PAYLOAD_TOO_LARGE", "413"],
    ["UNPROCESSABLE_CONTENT", "422"],
    ["TOO_MANY_REQUESTS", "429"],
    ["CLIENT_CLOSED_REQUEST", "499"],
    ["INTERNAL_SERVER_ERROR", "500"],
  ])("labels %s as %s", (code, expected) => {
    expect(observedStatusCode(code)).toBe(expected);
  });

  it("falls back to 500 for an unrecognised code", () => {
    expect(observedStatusCode("NOT_A_REAL_CODE")).toBe("500");
  });
});

// No app code throws these today, so they are pinned to keep the Prometheus
// series stable if one starts being raised.
describe("recordTrpcFailure status_code label — infrastructure codes", () => {
  it.each([
    ["PARSE_ERROR", "400"],
    ["PAYMENT_REQUIRED", "402"],
    ["UNSUPPORTED_MEDIA_TYPE", "415"],
    ["PRECONDITION_REQUIRED", "428"],
    ["NOT_IMPLEMENTED", "501"],
    ["BAD_GATEWAY", "502"],
    ["SERVICE_UNAVAILABLE", "503"],
    ["GATEWAY_TIMEOUT", "504"],
  ])("labels %s as %s", (code, expected) => {
    expect(observedStatusCode(code)).toBe(expected);
  });
});
