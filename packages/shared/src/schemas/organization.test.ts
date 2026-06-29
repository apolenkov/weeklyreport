import { describe, expect, it } from "vitest";

import {
  organizationPublicSchema,
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

  it("still enforces the existing length bounds (shortName ≤ 16, fullName ≤ 200)", () => {
    expect(
      organizationUpdateSchema.safeParse({
        shortName: "A".repeat(17),
        fullName: "ok",
      }).success,
    ).toBe(false);
    expect(
      organizationUpdateSchema.safeParse({
        shortName: "ok",
        fullName: "A".repeat(201),
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
