import { describe, expect, it, vi } from "vitest";
import { TRPCClientError } from "@trpc/client";

import {
  buildClientErrorLogEntry,
  formatClientErrorMessage,
  getClientErrorDetails,
  logClientError,
} from "./client-error-reporting";

function makeTRPCError(
  message: string,
  data: Record<string, unknown>,
): TRPCClientError<never> {
  const error = new TRPCClientError<never>(message, {
    meta: {
      response: new Response(null, {
        headers: { "x-request-id": "req-from-header" },
      }),
    },
  });
  Object.defineProperty(error, "data", {
    value: data,
    configurable: true,
  });
  return error;
}

describe("client-error-reporting", () => {
  it("builds a stable log envelope for Error instances", () => {
    const error = new TypeError("Failed to load status report");

    expect(
      buildClientErrorLogEntry("weeklyReport.get.load_failed", error, {
        reportId: "report-1",
      }),
    ).toEqual({
      event: "weeklyReport.get.load_failed",
      message: "Failed to load status report",
      name: "TypeError",
      context: { reportId: "report-1" },
    });
  });

  it("logs the original Error so the browser forwarder can capture stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Unexpected error");

    logClientError("weeklyReport.get.load_failed", error, {
      procedure: "weeklyReport.get",
    });

    expect(spy).toHaveBeenCalledWith(
      "[weeklyReport.get.load_failed] Unexpected error",
      error,
      { procedure: "weeklyReport.get" },
    );

    spy.mockRestore();
  });

  it("extracts request id and tRPC status details from client errors", () => {
    const error = makeTRPCError("Unexpected error", {
      code: "INTERNAL_SERVER_ERROR",
      httpStatus: 500,
      requestId: "req-from-shape",
    });

    expect(getClientErrorDetails(error)).toEqual({
      requestId: "req-from-shape",
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
      isInternal: true,
    });
  });

  it("falls back to x-request-id response header when shape has no requestId", () => {
    const error = makeTRPCError("Unexpected error", {
      code: "INTERNAL_SERVER_ERROR",
      httpStatus: 500,
    });

    expect(getClientErrorDetails(error).requestId).toBe("req-from-header");
  });

  it("formats internal errors without echoing the generic Unexpected error text", () => {
    const error = makeTRPCError("Unexpected error", {
      code: "INTERNAL_SERVER_ERROR",
      httpStatus: 500,
      requestId: "req-500",
    });

    expect(
      formatClientErrorMessage("Failed to load status report", error),
    ).toBe("Failed to load status report. Reference: req-500.");
  });

  it("adds request id details to the forwarded client log context", () => {
    const error = makeTRPCError("Unexpected error", {
      code: "INTERNAL_SERVER_ERROR",
      httpStatus: 500,
      requestId: "req-log",
    });

    expect(
      buildClientErrorLogEntry("weeklyReport.get.load_failed", error, {
        procedure: "weeklyReport.get",
      }).context,
    ).toEqual({
      procedure: "weeklyReport.get",
      requestId: "req-log",
      httpStatus: 500,
      trpcCode: "INTERNAL_SERVER_ERROR",
    });
  });
});
