import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../lib/logger.js";
import { httpRequestDurationSeconds } from "../metrics/metrics.registry.js";
import {
  logInputBreadcrumb,
  recordTrpcFailure,
  type TrpcCallIdentity,
} from "./trpc.logging.js";

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

function asTrpcError(code: string): TRPCError {
  const error = new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  Object.defineProperty(error, "code", { value: code });
  return error;
}

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

// describeShape runs on every request before the log level is even checked,
// so a deep or wide payload must not grow the debug line (or the stack).
// It is exercised through the public breadcrumb with a debug spy.
describe("describeShape bounds through logInputBreadcrumb", () => {
  async function captureInputShape(
    value: unknown,
  ): Promise<{ calls: number; shape: string | undefined }> {
    const debug =
      vi.fn<(message: string, context?: Record<string, unknown>) => void>();
    const logger: AppLogger = {
      debug,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      child: () => logger,
    };

    await logInputBreadcrumb(logger, "p", "mutation", () =>
      Promise.resolve(value),
    );

    const meta = debug.mock.calls[0]?.[1];
    return {
      calls: debug.mock.calls.length,
      shape: meta?.inputShape as string | undefined,
    };
  }

  it("caps nested-array depth and marks the shape with …", async () => {
    let deep: unknown = 1;
    for (let level = 0; level < 200; level += 1) deep = [deep];

    const { shape } = await captureInputShape(deep);

    expect(shape).toBeDefined();
    expect(shape).toContain("…");
    expect((shape ?? "").split("array[1]<").length - 1).toBeLessThanOrEqual(5);
  });

  it("caps the key list at 50 and counts the rest", async () => {
    const wide: Record<string, number> = {};
    for (let i = 0; i < 1000; i += 1) {
      wide[`k${String(i).padStart(3, "0")}`] = i;
    }

    const { shape } = await captureInputShape(wide);

    expect(shape).toBeDefined();
    expect(shape).toContain("object{k000,");
    expect(shape).not.toContain("k050");
    expect(shape?.endsWith(",+950 more}")).toBe(true);
  });

  it("reports a self-referencing array once as [circular] instead of throwing", async () => {
    const self: unknown[] = [];
    self.push(self);

    const { calls, shape } = await captureInputShape(self);

    expect(calls).toBe(1);
    expect(shape).toContain("[circular]");
  });

  it("keeps the existing format for small shapes", async () => {
    expect((await captureInputShape({ b: 1, a: [{ c: 1 }] })).shape).toBe(
      "object{a,b}",
    );
    expect((await captureInputShape([])).shape).toBe("array[0]");
    expect((await captureInputShape([{ id: 1 }, { id: 2 }])).shape).toBe(
      "array[2]<object{id}>",
    );
  });
});
