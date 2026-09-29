import { describe, expect, it } from "vitest";

import { shortItemLabel } from "./short-label";

describe("shortItemLabel", () => {
  it("keeps short text and collapses whitespace", () => {
    expect(shortItemLabel("  Ship\n the   fix ")).toBe("Ship the fix");
  });

  it("truncates long text to a short reference", () => {
    const label = shortItemLabel("word ".repeat(200));
    expect(label.length).toBeLessThanOrEqual(60);
    expect(label.endsWith("…")).toBe(true);
  });
});
