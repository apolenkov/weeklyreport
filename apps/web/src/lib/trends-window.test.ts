import { describe, expect, it } from "vitest";

import { deriveTrendsWindow } from "./trends-window";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

describe("deriveTrendsWindow", () => {
  it("spans exactly 12 months back from the anchor", () => {
    expect(deriveTrendsWindow(new Date("2026-06-14T00:00:00Z"))).toEqual({
      periodFrom: "2025-06-14",
      periodTo: "2026-06-14",
    });
  });

  it("handles a year boundary", () => {
    expect(deriveTrendsWindow(new Date("2027-03-15T00:00:00Z"))).toEqual({
      periodFrom: "2026-03-15",
      periodTo: "2027-03-15",
    });
  });

  it("clamps a leap-day anchor to the prior year's Feb 28 instead of overflowing to Mar 1", () => {
    const window = deriveTrendsWindow(new Date("2028-02-29T12:00:00.000Z"));

    expect(window.periodFrom).toBe("2027-02-28");
    expect(window.periodTo).toBe("2028-02-29");
  });

  it("emits YYYY-MM-DD strings the analytics queries expect", () => {
    const window = deriveTrendsWindow(new Date("2026-01-05T12:34:56Z"));
    expect(window.periodFrom).toMatch(DATE_ONLY);
    expect(window.periodTo).toMatch(DATE_ONLY);
    expect(window).toEqual({
      periodFrom: "2025-01-05",
      periodTo: "2026-01-05",
    });
  });
});
