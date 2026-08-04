import { describe, expect, it } from "vitest";

import { OFFSET_UNITS, type OffsetUnit } from "./reminders-tab-format";

describe("OFFSET_UNITS", () => {
  it("is the exact offset-unit vocabulary", () => {
    expect(OFFSET_UNITS).toEqual(["minutes", "hours", "days"]);
  });

  it("covers the OffsetUnit union — any future unit is a compile error", () => {
    const assertCovered = (unit: OffsetUnit): boolean =>
      (OFFSET_UNITS as readonly string[]).includes(unit);
    for (const unit of OFFSET_UNITS) {
      expect(assertCovered(unit)).toBe(true);
    }
  });
});
