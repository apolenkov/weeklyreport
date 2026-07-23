import {
  organizationPublicSchema,
  organizationSchema,
  organizationUpdateSchema,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

/**
 * Contract tests for the Organization zod schemas.
 *
 * Boundary checks: shortName ≤ 16, fullName ≤ 200, both non-empty, id
 * locked to the literal 'singleton'. These are the invariants the rest
 * of the system relies on (nav-bar width, PDF header width, singleton
 * write path).
 */
describe("organizationSchema", () => {
  const validRow = {
    id: "singleton" as const,
    shortName: "PEO",
    fullName: "Product Engineering & Operations",
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
  const breakoutMessage = "must not contain '<' or '>'";

  it("omits id from the input shape (singleton invariant lives on the server)", () => {
    const result = organizationUpdateSchema.parse({
      shortName: "PEO",
      fullName: "Product Engineering & Operations",
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

  it.each([
    { field: "shortName", value: "A<B" },
    { field: "shortName", value: "A>B" },
    { field: "fullName", value: "A<B" },
    { field: "fullName", value: "A>B" },
  ] as const)(
    "rejects $field containing a breakout character",
    ({ field, value }) => {
      const result = organizationUpdateSchema.safeParse({
        shortName: "OK",
        fullName: "OK",
        [field]: value,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({ message: breakoutMessage, path: [field] }),
        );
      }
    },
  );

  it("accepts boundary-length values without breakout characters", () => {
    expect(
      organizationUpdateSchema.parse({
        shortName: "A".repeat(16),
        fullName: "B".repeat(200),
      }),
    ).toEqual({
      shortName: "A".repeat(16),
      fullName: "B".repeat(200),
    });
  });
});

describe("organizationPublicSchema", () => {
  it("strips timestamps and id from the public projection", () => {
    const pub = organizationPublicSchema.parse({
      id: "singleton",
      shortName: "PEO",
      fullName: "Product Engineering & Operations",
      createdAt: new Date("2026-05-10T00:00:00Z"),
      updatedAt: new Date("2026-05-10T00:00:00Z"),
    });
    expect(Object.keys(pub).sort()).toEqual(["fullName", "shortName"]);
    expect(pub).toEqual({
      shortName: "PEO",
      fullName: "Product Engineering & Operations",
    });
    expect((pub as { id?: unknown }).id).toBeUndefined();
    expect((pub as { createdAt?: unknown }).createdAt).toBeUndefined();
    expect((pub as { updatedAt?: unknown }).updatedAt).toBeUndefined();
  });
});
