import { describe, expect, it } from "vitest";

import { latestPeriodPair } from "./analytics-periods";

describe("latestPeriodPair", () => {
  it("returns the two most recent period-end labels (B is newest)", () => {
    const periods = [
      { periodStart: "2026-05-12", periodEnd: "2026-05-17" },
      { periodStart: "2026-05-20", periodEnd: "2026-05-24" },
      { periodStart: "2026-05-25", periodEnd: "2026-05-31" },
      { periodStart: "2026-06-01", periodEnd: "2026-06-07" },
      { periodStart: "2026-06-08", periodEnd: "2026-06-14" },
    ];
    expect(latestPeriodPair(periods)).toEqual({
      periodA: "2026-06-07",
      periodB: "2026-06-14",
    });
  });

  it("works with exactly two periods", () => {
    expect(
      latestPeriodPair([
        { periodStart: "2026-05-12", periodEnd: "2026-05-17" },
        { periodStart: "2026-05-20", periodEnd: "2026-05-24" },
      ]),
    ).toEqual({
      periodA: "2026-05-17",
      periodB: "2026-05-24",
    });
  });

  it("returns null when fewer than two periods exist", () => {
    expect(latestPeriodPair([])).toBeNull();
    expect(
      latestPeriodPair([
        { periodStart: "2026-05-20", periodEnd: "2026-05-24" },
      ]),
    ).toBeNull();
  });
});
