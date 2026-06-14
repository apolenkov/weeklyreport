import { TRPCClientError } from "@trpc/client";
import { describe, expect, it, vi } from "vitest";

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
    const spy = vi.spyOn(console, "error").mockImplementation(() => {
      /* intentionally empty: suppress console output during test */
    });
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
      isDeterministicClientError: false,
      isInvalidLink: false,
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

  // Driver finding 1: a malformed reportId fails the UUID check and tRPC
  // serializes the Zod issues array (with the `pattern` regex) into
  // error.message. That MUST NOT reach the user toast.
  const ZOD_ISSUES_MESSAGE = JSON.stringify(
    [
      {
        origin: "string",
        code: "invalid_format",
        format: "uuid",
        pattern:
          "/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$/",
        path: ["reportId"],
        message: "Invalid UUID",
      },
    ],
    null,
    2,
  );

  it("flags a BAD_REQUEST as a deterministic client error", () => {
    const error = makeTRPCError(ZOD_ISSUES_MESSAGE, {
      code: "BAD_REQUEST",
      httpStatus: 400,
      requestId: "req-400",
    });

    const details = getClientErrorDetails(error);
    expect(details.isInternal).toBe(false);
    expect(details.isDeterministicClientError).toBe(true);
  });

  it("flags a NOT_FOUND as a deterministic client error", () => {
    const error = makeTRPCError("Report not found", {
      code: "NOT_FOUND",
      httpStatus: 404,
      requestId: "req-404",
    });

    expect(getClientErrorDetails(error).isDeterministicClientError).toBe(true);
  });

  it("does not flag a 5xx as a deterministic client error", () => {
    const error = makeTRPCError("Unexpected error", {
      code: "INTERNAL_SERVER_ERROR",
      httpStatus: 500,
      requestId: "req-500",
    });

    expect(getClientErrorDetails(error).isDeterministicClientError).toBe(false);
  });

  it("suppresses the raw Zod issues array in a validation toast", () => {
    const error = makeTRPCError(ZOD_ISSUES_MESSAGE, {
      code: "BAD_REQUEST",
      httpStatus: 400,
      requestId: "req-400",
    });

    const message = formatClientErrorMessage(
      "Failed to load status report",
      error,
    );

    expect(message).toBe(
      "Failed to load status report: This link is invalid or the report no longer exists. Reference: req-400.",
    );
    expect(message).not.toContain("pattern");
    expect(message).not.toContain("invalid_format");
    expect(message).not.toContain("[");
  });

  it("treats a 403 as retry-skippable but NOT an invalid-link message", () => {
    const error = makeTRPCError("Forbidden: you cannot view this report", {
      code: "FORBIDDEN",
      httpStatus: 403,
      requestId: "req-403",
    });

    const details = getClientErrorDetails(error);
    // 403 is a deterministic 4xx (skip retry) but keeps its own message: the
    // invalid-link copy would be wrong for a forbidden/expired-session error.
    expect(details.isDeterministicClientError).toBe(true);
    expect(details.isInvalidLink).toBe(false);

    const message = formatClientErrorMessage("Failed to load report", error);
    expect(message).toContain("Forbidden: you cannot view this report");
    expect(message).not.toContain("This link is invalid");
  });

  it("does not echo a NOT_FOUND raw message into the toast", () => {
    const error = makeTRPCError("Some internal not-found detail", {
      code: "NOT_FOUND",
      httpStatus: 404,
      requestId: "req-404",
    });

    const message = formatClientErrorMessage("Failed to load report", error);

    expect(message).not.toContain("Some internal not-found detail");
    expect(message).toContain(
      "This link is invalid or the report no longer exists.",
    );
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
