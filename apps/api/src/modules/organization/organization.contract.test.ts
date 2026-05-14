import { describe, it, expect } from "vitest";

import {
  organizationSchema,
  organizationUpdateSchema,
  organizationPublicSchema,
} from "@customreport/shared";

/**
 * UFB-047 / Phase 48-A: contract tests for the Organization zod schemas.
 *
 * Boundary checks: shortName ≤ 16, fullName ≤ 200, both non-empty, id
 * locked to the literal 'singleton'. These are the invariants the rest
 * of the system relies on (nav-bar width, PDF header width, singleton
 * write path).
 */
describe("organizationSchema", () => {
  const validRow = {
    id: "singleton" as const,
    shortName: "Demo",
    fullName: "Example Software Department",
    createdAt: new Date("2026-05-10T00:00:00Z"),
    updatedAt: new Date("2026-05-10T00:00:00Z"),
  };

  it("accepts the canonical singleton row", () => {
    expect(organizationSchema.parse(validRow).id).toBe("singleton");
  });

  it("rejects id values other than singleton", () => {
    expect(() =>
      organizationSchema.parse({ ...validRow, id: "other" }),
    ).toThrow();
  });

  it("rejects shortName at 17 chars (boundary +1)", () => {
    expect(() =>
      organizationSchema.parse({ ...validRow, shortName: "A".repeat(17) }),
    ).toThrow();
  });

  it("accepts shortName at exactly 16 chars (boundary)", () => {
    expect(
      organizationSchema.parse({ ...validRow, shortName: "A".repeat(16) })
        .shortName,
    ).toHaveLength(16);
  });

  it("rejects empty shortName", () => {
    expect(() =>
      organizationSchema.parse({ ...validRow, shortName: "" }),
    ).toThrow();
  });

  it("rejects fullName at 201 chars (boundary +1)", () => {
    expect(() =>
      organizationSchema.parse({ ...validRow, fullName: "A".repeat(201) }),
    ).toThrow();
  });

  it("accepts fullName at exactly 200 chars (boundary)", () => {
    expect(
      organizationSchema.parse({ ...validRow, fullName: "A".repeat(200) })
        .fullName,
    ).toHaveLength(200);
  });
});

describe("organizationUpdateSchema", () => {
  it("omits id from the input shape (singleton invariant lives on the server)", () => {
    const result = organizationUpdateSchema.parse({
      shortName: "Demo",
      fullName: "Example Software Department",
    });
    expect((result as { id?: unknown }).id).toBeUndefined();
  });

  it("enforces shortName bounds on the write path", () => {
    expect(() =>
      organizationUpdateSchema.parse({
        shortName: "A".repeat(17),
        fullName: "OK",
      }),
    ).toThrow();
  });
});

describe("organizationPublicSchema", () => {
  it("strips timestamps and id from the public projection", () => {
    const pub = organizationPublicSchema.parse({
      shortName: "Demo",
      fullName: "Example Software Department",
    });
    expect(Object.keys(pub).sort()).toEqual(["fullName", "shortName"]);
  });
});
