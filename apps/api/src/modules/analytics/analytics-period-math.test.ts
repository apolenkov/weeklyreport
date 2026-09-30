import { describe, expect, it } from "vitest";

import {
  collectComparisonCells,
  type ComparisonReport,
  statusForProject,
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
    publishedAt: new Date("2026-04-21T10:00:00.000Z"),
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
    publishedAt: new Date("2026-04-21T22:00:00.000Z"),
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

  it("does not restore an older status when the effective report omits the project", () => {
    const withoutProject: ComparisonReport = {
      ...republished,
      sections: [{ projectStatuses: [], risks: [] }],
    };
    const reports = [original, withoutProject];

    expect(statusForProject(reports, PROJECT_ID)).toBeNull();
    expect(collectComparisonCells(reports).get(PROJECT_ID)).toBeUndefined();
  });

  it("retains an explicit null status and its project name in both views", () => {
    const withoutStatus: ComparisonReport = {
      ...republished,
      sections: [
        {
          projectStatuses: [
            { projectId: PROJECT_ID, status: null, project: { name: "CRM" } },
          ],
          risks: [],
        },
      ],
    };
    const reports = [original, withoutStatus];

    expect(statusForProject(reports, PROJECT_ID)).toBeNull();
    expect(collectComparisonCells(reports).get(PROJECT_ID)).toEqual({
      status: null,
      risks: 0,
      name: "CRM",
    });
  });

  it.each([
    [null, "green"],
    ["green", null],
    ["green", "red"],
    ["red", "green"],
    [null, null],
  ] as const)(
    "uses the last snapshot occurrence for a shared project's statuses %s then %s",
    (first, last) => {
      const report: ComparisonReport = {
        ...republished,
        sections: [first, last].map((status) => ({
          projectStatuses: [
            { projectId: PROJECT_ID, status, project: { name: "CRM" } },
          ],
          risks: [],
        })),
      };

      expect.soft(statusForProject([report], PROJECT_ID)).toBe(last);
      expect(collectComparisonCells([report]).get(PROJECT_ID)?.status).toBe(
        last,
      );
    },
  );

  it("uses publication time before creation time or the periodEnd time of day", () => {
    const latestPublication: ComparisonReport = {
      ...original,
      publishedAt: new Date("2026-04-22T10:00:00.000Z"),
    };
    const reports = [latestPublication, republished];

    expect(statusForProject(reports, PROJECT_ID)).toBe("yellow");
    expect(collectComparisonCells(reports).get(PROJECT_ID)?.status).toBe(
      "yellow",
    );
  });

  it("uses creation time when publication times are equal within a date label", () => {
    const latestCreated: ComparisonReport = {
      ...original,
      publishedAt: republished.publishedAt,
      createdAt: new Date("2026-04-22T10:00:00.000Z"),
    };
    const reports = [latestCreated, republished];

    expect(statusForProject(reports, PROJECT_ID)).toBe("yellow");
    expect(collectComparisonCells(reports).get(PROJECT_ID)?.status).toBe(
      "yellow",
    );
  });

  it.each([false, true])(
    "uses the largest id for equal publication and creation times (reversed=%s)",
    (reversed) => {
      const tied: ComparisonReport = {
        ...republished,
        periodEnd: original.periodEnd,
        publishedAt: original.publishedAt,
        createdAt: original.createdAt,
      };
      const reports = reversed ? [tied, original] : [original, tied];

      expect(statusForProject(reports, PROJECT_ID)).toBe("red");
      expect(collectComparisonCells(reports).get(PROJECT_ID)).toEqual({
        status: "red",
        risks: 1,
        name: "CRM",
      });
    },
  );
});
