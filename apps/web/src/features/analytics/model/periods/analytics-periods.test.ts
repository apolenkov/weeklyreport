import { describe, expect, it } from "vitest";

import { latestPeriodPair } from "./analytics-periods";

const OMISSIONS = { risks: 0, decisions: 0, unknown: false };

describe("latestPeriodPair", () => {
  it("returns the two most recent period-end labels (B is newest)", () => {
    const periods = [
      {
        periodStart: "2026-05-12",
        periodEnd: "2026-05-17",
        omissions: OMISSIONS,
      },
      {
        periodStart: "2026-05-20",
        periodEnd: "2026-05-24",
        omissions: OMISSIONS,
      },
      {
        periodStart: "2026-05-25",
        periodEnd: "2026-05-31",
        omissions: OMISSIONS,
      },
      {
        periodStart: "2026-06-01",
        periodEnd: "2026-06-07",
        omissions: OMISSIONS,
      },
      {
        periodStart: "2026-06-08",
        periodEnd: "2026-06-14",
        omissions: OMISSIONS,
      },
    ];
    expect(latestPeriodPair(periods)).toEqual({
      periodA: "2026-06-07",
      periodB: "2026-06-14",
    });
  });

  it("works with exactly two periods", () => {
    expect(
      latestPeriodPair([
        {
          periodStart: "2026-05-12",
          periodEnd: "2026-05-17",
          omissions: OMISSIONS,
        },
        {
          periodStart: "2026-05-20",
          periodEnd: "2026-05-24",
          omissions: OMISSIONS,
        },
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
        {
          periodStart: "2026-05-20",
          periodEnd: "2026-05-24",
          omissions: OMISSIONS,
        },
      ]),
    ).toBeNull();
  });
});
