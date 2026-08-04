import { describe, expect, it } from "vitest";

import {
  isUniqueViolation,
  PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE,
} from "./prisma-unique-violation.js";

// The pg-adapter P2002 shape: `meta.target` is UNSET and the constraint identity
// surfaces only in `message` + serialized `meta`. A guard reading `meta.target`
// alone misses this; these cases pin that it does not.
const OPEN_BOUNDARY_INDEX = "Report_one_open_per_boundary";

function pgAdapterP2002(originalMessage: string, message: string): unknown {
  return {
    code: PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE,
    message,
    // No `meta.target` — exactly what the pg driver adapter produces.
    meta: {
      driverAdapterError: { cause: { originalMessage } },
    },
  };
}

describe("isUniqueViolation", () => {
  it("exports the P2002 error code as a shared constant", () => {
    expect(PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE).toBe("P2002");
  });

  it("matches a scoped index when meta.target is unset (pg-adapter shape)", () => {
    const error = pgAdapterP2002(
      `duplicate key value violates unique constraint "${OPEN_BOUNDARY_INDEX}"`,
      "Unique constraint failed",
    );

    expect(
      (error as { meta?: { target?: unknown } }).meta?.target,
    ).toBeUndefined();
    expect(isUniqueViolation(error, { index: OPEN_BOUNDARY_INDEX })).toBe(true);
  });

  it("matches a scoped index in the plain Prisma message form", () => {
    const error = {
      code: PRISMA_UNIQUE_CONSTRAINT_ERROR_CODE,
      message: `Unique constraint failed on "${OPEN_BOUNDARY_INDEX}"`,
    };

    expect(isUniqueViolation(error, { index: OPEN_BOUNDARY_INDEX })).toBe(true);
  });

  it("matches a scoped composite column set present in the identity", () => {
    const error = pgAdapterP2002(
      "duplicate key value violates unique constraint on (periodStart, periodEnd)",
      "Unique constraint failed",
    );

    expect(
      isUniqueViolation(error, { columns: ["periodStart", "periodEnd"] }),
    ).toBe(true);
  });

  it("requires ALL composite columns — a partial overlap does not match", () => {
    const error = pgAdapterP2002(
      "duplicate key value violates unique constraint on (periodStart)",
      "Unique constraint failed",
    );

    expect(
      isUniqueViolation(error, { columns: ["periodStart", "periodEnd"] }),
    ).toBe(false);
  });

  it("returns false for an unrelated-constraint P2002 under a scope (re-throws)", () => {
    const error = pgAdapterP2002(
      'duplicate key value violates unique constraint "SomeOther_index"',
      "Unique constraint failed",
    );

    expect(isUniqueViolation(error, { index: OPEN_BOUNDARY_INDEX })).toBe(
      false,
    );
  });

  it("rejects index and column substrings inside unrelated identifiers", () => {
    const error = pgAdapterP2002(
      `duplicate key value violates unique constraint "Archived_${OPEN_BOUNDARY_INDEX}_backup"`,
      "Unique constraint failed on dedupeKeyBackup",
    );

    expect(isUniqueViolation(error, { index: OPEN_BOUNDARY_INDEX })).toBe(
      false,
    );
    expect(isUniqueViolation(error, { columns: ["dedupeKey"] })).toBe(false);
  });

  it("returns true for any P2002 when unscoped", () => {
    expect(
      isUniqueViolation({ code: "P2002", message: "whatever", meta: {} }),
    ).toBe(true);
  });

  it("returns false for a non-P2002 error", () => {
    expect(isUniqueViolation({ code: "P2025", message: "not found" })).toBe(
      false,
    );
    expect(isUniqueViolation({ code: "P2002" }, { index: "X" })).toBe(false);
  });

  it("returns false for non-object inputs", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("P2002")).toBe(false);
  });
});
