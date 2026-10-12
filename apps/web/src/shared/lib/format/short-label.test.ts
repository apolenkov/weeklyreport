import { describe, expect, it } from "vitest";

import { shortItemLabel } from "./short-label";

describe("shortItemLabel", () => {
  it("keeps short text and collapses whitespace", () => {
    expect(shortItemLabel("  Ship\n the   fix ")).toBe("Ship the fix");
  });

  it.each([
    { text: `${"x".repeat(58)}😀tail`, expected: `${"x".repeat(58)}…` },
    { text: `${"x".repeat(58)}e\u0301tail`, expected: `${"x".repeat(58)}…` },
    { text: `${"x".repeat(55)}👨‍👩‍👧tail`, expected: `${"x".repeat(55)}…` },
    { text: `${"x".repeat(57)}🇷🇺tail`, expected: `${"x".repeat(57)}…` },
    { text: "short 😀 e\u0301 👨‍👩‍👧", expected: "short 😀 e\u0301 👨‍👩‍👧" },
    { text: "x".repeat(60), expected: "x".repeat(60) },
    { text: "x".repeat(61), expected: `${"x".repeat(59)}…` },
  ])(
    "keeps whole graphemes within the existing budget: $text",
    ({ text, expected }) => {
      const label = shortItemLabel(text);
      expect(label).toBe(expected);
      expect(label.isWellFormed()).toBe(true);
      expect(label.length).toBeLessThanOrEqual(60);
    },
  );

  it("truncates long text to a short reference", () => {
    const label = shortItemLabel("word ".repeat(200));
    expect(label.length).toBeLessThanOrEqual(60);
    expect(label.endsWith("…")).toBe(true);
  });
});
