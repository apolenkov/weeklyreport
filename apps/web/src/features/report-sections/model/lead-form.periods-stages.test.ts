import type {
  MyHistoryEntry,
  ReportSectionReadModel,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  mapLeadFormData,
  mapLeadPeriods,
  mapLeadProducts,
  ownedStagesForProject,
  stageNamesMatch,
} from "./lead-form";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_A = "44444444-4444-4444-8444-444444444444";
const PROJECT_B = "55555555-5555-4555-8555-555555555555";
/** One attached activity for the activity-lane routing tests. */
function baseSection(
  overrides: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Тимлид 1",
    version: 1,
    status: "draft",
    submittedAt: null,
    projects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    ...overrides,
  };
}

describe("mapLeadPeriods", () => {
  it("flags the active report id as isCurrent and submitted sections as isSubmitted", () => {
    const history: MyHistoryEntry[] = [
      {
        sectionId: SECTION_ID,
        reportId: REPORT_ID,
        periodStart: new Date("2026-04-14T00:00:00Z"),
        periodEnd: new Date("2026-04-20T00:00:00Z"),
        reportStatus: "draft",
        sectionStatus: "draft",
        submittedAt: null,
        publishedAt: null,
        itemCount: 7,
        riskCount: 2,
        productCount: 4,
      },
      {
        sectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        reportId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        periodStart: new Date("2026-04-07T00:00:00Z"),
        periodEnd: new Date("2026-04-13T00:00:00Z"),
        reportStatus: "published",
        sectionStatus: "submitted",
        submittedAt: new Date("2026-04-13T17:42:00Z"),
        publishedAt: new Date("2026-04-13T18:00:00Z"),
      },
    ];

    const periods = mapLeadPeriods(history, REPORT_ID);

    expect(expectDefined(periods[0]).isCurrent).toBe(true);
    expect(expectDefined(periods[0]).isSubmitted).toBe(false);
    expect(expectDefined(periods[1]).isCurrent).toBe(false);
    expect(expectDefined(periods[1]).isSubmitted).toBe(true);
    expect(expectDefined(periods[0]).dateRange).toBe("Apr 14–20, 2026");
    expect(expectDefined(periods[0]).itemCount).toBe(7);
    expect(expectDefined(periods[0]).riskCount).toBe(2);
    expect(expectDefined(periods[0]).productCount).toBe(4);
  });
});

describe("mapLeadFormData", () => {
  it("returns all empty collections when the section is empty", () => {
    const section = baseSection();
    const result = mapLeadFormData({
      active: section,
      byPeriod: { section, readOnly: false },
      history: [],
    });
    expect(result.products).toEqual([]);
    expect(result.currentWeekItems).toEqual([]);
    expect(result.nextWeekItems).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.decisions).toEqual([]);
    expect(result.priorities).toEqual([]);
    expect(result.periods).toEqual([]);
    expect(result.readOnly).toBe(false);
    expect(result.currentUser.name).toBe("Тимлид 1");
    expect(result.currentUser.initials).toBe("Т1");
  });

  it("locks readOnly when section status is submitted", () => {
    const section = baseSection({
      status: "submitted",
      submittedAt: new Date("2026-04-20T18:00:00Z"),
    });
    const result = mapLeadFormData({
      active: section,
      byPeriod: { section, readOnly: false },
      history: [],
    });
    expect(result.readOnly).toBe(true);
  });

  it("locks readOnly when byPeriod marks the period as read-only", () => {
    const section = baseSection();
    const result = mapLeadFormData({
      active: section,
      byPeriod: { section, readOnly: true },
      history: [],
    });
    expect(result.readOnly).toBe(true);
  });
});

describe("stageNamesMatch", () => {
  it("treats 'Development' and 'Dev' as equivalent (alias)", () => {
    expect(stageNamesMatch("Development", "Dev")).toBe(true);
    expect(stageNamesMatch("Dev", "Development")).toBe(true);
    expect(stageNamesMatch("development", "dev")).toBe(true);
  });

  it("matches identical names case-insensitively", () => {
    expect(stageNamesMatch("Planning", "Planning")).toBe(true);
    expect(stageNamesMatch("TESTING", "testing")).toBe(true);
  });

  it("does not match unrelated names", () => {
    expect(stageNamesMatch("Planning", "Testing")).toBe(false);
    expect(stageNamesMatch("Dev", "DevOps")).toBe(false);
  });
});

describe("ownedStagesForProject", () => {
  it("returns the canonical 'Development' name (no short alias) for an owned stage", () => {
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "s1",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
          ],
        },
      ],
    });
    const result = ownedStagesForProject(section, PROJECT_A);
    expect(result).toContain("Development");
    expect(result).not.toContain("Dev");
  });

  it("returns canonical names for all owned stages scoped to a project", () => {
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "s1",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
            { stageId: "s2", stageName: "Testing", sortOrder: 4, status: null },
          ],
        },
        {
          projectId: PROJECT_B,
          projectName: "ERP",
          trafficLight: "yellow",
          ownedStages: [
            {
              stageId: "s3",
              stageName: "Planning",
              sortOrder: 1,
              status: null,
            },
          ],
        },
      ],
    });
    const resultA = ownedStagesForProject(section, PROJECT_A);
    expect([...resultA].sort()).toEqual(["Development", "Testing"]);

    const resultB = ownedStagesForProject(section, PROJECT_B);
    expect(resultB).toEqual(["Planning"]);
  });

  it("returns union across all projects when projectId is undefined", () => {
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM",
          trafficLight: "green",
          ownedStages: [
            { stageId: "s1", stageName: "Dev", sortOrder: 3, status: "green" },
          ],
        },
        {
          projectId: PROJECT_B,
          projectName: "ERP",
          trafficLight: null,
          ownedStages: [
            {
              stageId: "s2",
              stageName: "Planning",
              sortOrder: 1,
              status: null,
            },
          ],
        },
      ],
    });
    const result = ownedStagesForProject(section, undefined);
    expect([...result].sort()).toEqual(["Development", "Planning"]);
  });

  it("agrees with mapLeadProducts on which stages are 'mine'", () => {
    const section = baseSection({
      projects: [
        {
          projectId: PROJECT_A,
          projectName: "CRM",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "s1",
              stageName: "Development",
              sortOrder: 3,
              status: "green",
            },
            { stageId: "s2", stageName: "Testing", sortOrder: 4, status: null },
          ],
        },
      ],
    });
    const ownedNames = ownedStagesForProject(section, PROJECT_A);
    const products = mapLeadProducts(section);
    const mineInGrid =
      products[0]?.stages
        .filter((s) => s.ownership === "mine")
        .map((s) => s.stageName) ?? [];
    // Pin the exact expected set on both sides: a bare agreement check would
    // still pass if both paths regressed to empty.
    expect([...ownedNames].sort()).toEqual(["Development", "Testing"]);
    expect([...mineInGrid].sort()).toEqual(["Development", "Testing"]);
  });
});
