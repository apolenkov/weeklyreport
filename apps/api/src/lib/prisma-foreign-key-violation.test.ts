import { describe, expect, it } from "vitest";

import {
  isForeignKeyViolation,
  PRISMA_FOREIGN_KEY_CONSTRAINT_ERROR_CODE,
} from "./prisma-foreign-key-violation.js";

function pgAdapterP2003(): unknown {
  return {
    code: PRISMA_FOREIGN_KEY_CONSTRAINT_ERROR_CODE,
    message: "Foreign key constraint violated",
    meta: {
      driverAdapterError: {
        cause: {
          originalMessage:
            'insert or update violates foreign key constraint "RecordComment_itemId_fkey"',
        },
      },
    },
  };
}

describe("isForeignKeyViolation", () => {
  it("matches the pg-adapter P2003 shape without relying on meta target", () => {
    const error = pgAdapterP2003();

    expect(
      (error as { meta?: { target?: unknown } }).meta?.target,
    ).toBeUndefined();
    expect(isForeignKeyViolation(error)).toBe(true);
  });

  it("returns false for other Prisma codes and non-object inputs", () => {
    expect(isForeignKeyViolation({ code: "P2002" })).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
    expect(isForeignKeyViolation("P2003")).toBe(false);
  });
});
