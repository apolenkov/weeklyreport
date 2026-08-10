import { describe, expect, it } from "vitest";

import { latestPeriodPair } from "./analytics-periods";

describe("latestPeriodPair", () => {
  it("returns the two most recent period-end labels (B is newest)", () => {
    const periods = [
      "2026-05-17",
      "2026-05-24",
      "2026-05-31",
      "2026-06-07",
      "2026-06-14",
    ];
    expect(latestPeriodPair(periods)).toEqual({
      periodA: "2026-06-07",
      periodB: "2026-06-14",
    });
  });

  it("works with exactly two periods", () => {
    expect(latestPeriodPair(["2026-05-17", "2026-05-24"])).toEqual({
      periodA: "2026-05-17",
      periodB: "2026-05-24",
    });
  });

  it("returns null when fewer than two periods exist", () => {
    expect(latestPeriodPair([])).toBeNull();
    expect(latestPeriodPair(["2026-05-24"])).toBeNull();
  });
});
