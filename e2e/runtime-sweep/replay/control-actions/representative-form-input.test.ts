import { describe, expect, it } from "vitest";

import { representativeFillValueForInputType } from "./representative-form-input.ts";

describe("representative native form values", () => {
  it.each([
    ["text", "Runtime sweep"],
    ["search", "Runtime sweep"],
    ["email", "runtime-sweep@example.invalid"],
    ["number", "1"],
    ["date", "2026-01-01"],
    ["time", "12:00"],
    ["datetime-local", "2026-01-01T12:00"],
    ["url", "https://example.invalid"],
    [null, "Runtime sweep"],
    ["unknown", "Runtime sweep"],
  ] as const)(
    "uses a valid deterministic value for %s",
    (inputType, expected) => {
      expect(representativeFillValueForInputType(inputType)).toBe(expected);
    },
  );

  it("normalizes whitespace and case before selecting a native value", () => {
    expect(representativeFillValueForInputType(" DATETIME-LOCAL ")).toBe(
      "2026-01-01T12:00",
    );
  });
});
