import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { shouldRetryQuery } from "./query-client";

function makeTRPCError(
  message: string,
  data: Record<string, unknown>,
): TRPCClientError<never> {
  const error = new TRPCClientError<never>(message);
  Object.defineProperty(error, "data", {
    value: data,
    configurable: true,
  });
  return error;
}

describe("shouldRetryQuery", () => {
  // Driver finding 1: a deterministic 4xx (malformed reportId → BAD_REQUEST)
  // must fail once, not 1 + 3 retries (observed 207/400/400/400).
  it("does not retry a BAD_REQUEST (400)", () => {
    const error = makeTRPCError("Invalid UUID", {
      code: "BAD_REQUEST",
      httpStatus: 400,
    });

    expect(shouldRetryQuery(0, error)).toBe(false);
  });

  it("does not retry a NOT_FOUND (404)", () => {
    const error = makeTRPCError("Report not found", {
      code: "NOT_FOUND",
      httpStatus: 404,
    });

    expect(shouldRetryQuery(0, error)).toBe(false);
  });

  it("retries a transient 5xx until the default count", () => {
    const error = makeTRPCError("Unexpected error", {
      code: "INTERNAL_SERVER_ERROR",
      httpStatus: 500,
    });

    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(true);
    expect(shouldRetryQuery(3, error)).toBe(false);
  });

  it("retries a network error (no tRPC status) until the default count", () => {
    const error = new Error("Failed to fetch");

    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(3, error)).toBe(false);
  });
});
