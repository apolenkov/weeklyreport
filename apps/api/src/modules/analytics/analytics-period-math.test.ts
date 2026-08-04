import { describe, expect, it } from "vitest";

import {
  collectComparisonCells,
  type ComparisonReport,
} from "./analytics-period-math";

const PROJECT_ID = "20000000-0000-4000-8000-000000000002";
const RISK = { projectId: PROJECT_ID };

// A republished period is two published reports sharing a `periodEnd` calendar
// day; the LATEST report per label is authoritative, so a risk present in both
// the original and the republished report counts once, not twice.
describe("collectComparisonCells — republished-period risk dedupe", () => {
  const original: ComparisonReport = {
    id: "rep-1",
    periodEnd: new Date("2026-04-21T08:00:00.000Z"),
    createdAt: new Date("2026-04-21T09:00:00.000Z"),
    sections: [
      {
        projectStatuses: [
          { projectId: PROJECT_ID, status: "yellow", project: { name: "CRM" } },
        ],
        risks: [RISK],
      },
    ],
  };

  const republished: ComparisonReport = {
    id: "rep-2",
    periodEnd: new Date("2026-04-21T20:00:00.000Z"),
    createdAt: new Date("2026-04-21T21:00:00.000Z"),
    sections: [
      {
        projectStatuses: [
          { projectId: PROJECT_ID, status: "red", project: { name: "CRM" } },
        ],
        risks: [RISK],
      },
    ],
  };

  it("counts a republished risk once and takes the latest status", () => {
    const cells = collectComparisonCells([original, republished]);

    expect(cells.get(PROJECT_ID)).toEqual({
      status: "red",
      risks: 1,
      name: "CRM",
    });
  });

  it("keeps distinct risks from distinct period labels", () => {
    const otherWeek: ComparisonReport = {
      ...republished,
      id: "rep-3",
      periodEnd: new Date("2026-04-28T20:00:00.000Z"),
    };
    const cells = collectComparisonCells([original, republished, otherWeek]);

    expect(cells.get(PROJECT_ID)).toEqual({
      status: "red",
      risks: 2,
      name: "CRM",
    });
  });
});
