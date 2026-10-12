import { describe, expect, it } from "vitest";

import {
  MAX_FULL_NAME_LENGTH,
  MAX_SHORT_NAME_LENGTH,
  organizationPublicSchema,
  organizationSchema,
  organizationUpdateSchema,
} from "./organization.js";

describe("organizationUpdateSchema character guard", () => {
  it("rejects a fullName carrying a script-breakout payload", () => {
    expect(
      organizationUpdateSchema.safeParse({
        shortName: "Acme",
        fullName: "</script><img src=x onerror=alert(1)>",
      }).success,
    ).toBe(false);
  });

  it("rejects a shortName containing an angle bracket", () => {
    expect(
      organizationUpdateSchema.safeParse({ shortName: "a<b", fullName: "ok" })
        .success,
    ).toBe(false);
  });

  it("accepts a normal brand name with spaces, punctuation, and ampersand", () => {
    const parsed = organizationUpdateSchema.parse({
      shortName: "Acme",
      fullName: "Acme Platforms Inc. & Co.",
    });
    expect(parsed.fullName).toBe("Acme Platforms Inc. & Co.");
  });
});

describe("organization schemas current bounds", () => {
  it("uses the exported length bounds for stored, public, and update schemas", () => {
    expect(
      organizationUpdateSchema.safeParse({
        shortName: "A".repeat(MAX_SHORT_NAME_LENGTH + 1),
        fullName: "ok",
      }).success,
    ).toBe(false);
    expect(
      organizationUpdateSchema.safeParse({
        shortName: "ok",
        fullName: "A".repeat(MAX_FULL_NAME_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      organizationSchema.safeParse({
        id: "singleton",
        shortName: "ok",
        fullName: "A".repeat(MAX_FULL_NAME_LENGTH + 1),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).success,
    ).toBe(false);
    expect(
      organizationPublicSchema.safeParse({
        shortName: "ok",
        fullName: "A".repeat(MAX_FULL_NAME_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects unsafe characters in stored and public names", () => {
    expect(
      organizationPublicSchema.safeParse({
        shortName: "ok",
        fullName: "unsafe <name>",
      }).success,
    ).toBe(false);
    expect(
      organizationSchema.safeParse({
        id: "singleton",
        shortName: "ok",
        fullName: "unsafe >name",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).success,
    ).toBe(false);
  });
});

// Direct API writes and persisted/public projections share the brand boundary.
describe.each([
  ["update", organizationUpdateSchema],
  ["stored", organizationSchema],
  ["public", organizationPublicSchema],
] as const)("%s organization nonblank identity", (_name, schema) => {
  it.each(["shortName", "fullName"] as const)(
    "rejects whitespace-only %s while preserving meaningful spaced names",
    (field) => {
      const identity = {
        id: "singleton",
        shortName: " Acme ",
        fullName: "Acme Platforms & Co.",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(schema.safeParse(identity).success).toBe(true);
      expect(schema.safeParse({ ...identity, [field]: " \t\n " }).success).toBe(
        false,
      );
    },
  );
});
