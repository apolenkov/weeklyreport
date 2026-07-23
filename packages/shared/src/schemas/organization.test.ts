import { describe, expect, it } from "vitest";

import {
  MAX_FULL_NAME_LENGTH,
  MAX_SHORT_NAME_LENGTH,
  organizationPublicSchema,
  organizationSchema,
  organizationUpdateSchema,
} from "./organization";

describe("organizationUpdateSchema — HTML-delimiter charset guard", () => {
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

  it("uses the exported length bounds for stored and update schemas", () => {
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
  });

  it("read projection does NOT apply the charset guard (a legacy stored value parses on read)", () => {
    // The guard lives only at the write boundary; reads of already-stored rows
    // must never throw on a value persisted before the constraint existed.
    expect(
      organizationPublicSchema.safeParse({
        shortName: "ok",
        fullName: "legacy <name>",
      }).success,
    ).toBe(true);
  });
});
