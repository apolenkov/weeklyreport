import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import { projectStatusOverview } from "./status-overview";

const CURRENT_PRODUCT = "10000000-0000-4000-8000-000000000010";
const HISTORICAL_PRODUCT = "10000000-0000-4000-8000-000000000011";
const CURRENT_ACTIVITY = "10000000-0000-4000-8000-000000000012";
const HISTORICAL_ACTIVITY = "10000000-0000-4000-8000-000000000013";
const LINKED_PRODUCT_A = "10000000-0000-4000-8000-000000000014";
const LINKED_PRODUCT_B = "10000000-0000-4000-8000-000000000015";
const STABLE_CONTINUED = "10000000-0000-4000-8000-000000000020";
const STABLE_UNPLANNED = "10000000-0000-4000-8000-000000000021";

function item(overrides: {
  readonly id: string;
  readonly stableId: string;
  readonly projectId?: string;
  readonly activityId?: string;
  readonly type: "current" | "next";
  readonly text: string;
}) {
  return {
    ...overrides,
    tag: "delivery",
    workflowStatus:
      overrides.type === "next"
        ? ("planned" as const)
        : ("in_progress" as const),
    carriedOver: false,
  };
}

describe("projectStatusOverview", () => {
  it("projects products and activities as peers exactly once and appends historical parents", () => {
    const currentSection = makeReportSectionFixture({
      projects: [
        {
          projectId: CURRENT_PRODUCT,
          projectName: "Current product",
          trafficLight: "green",
        },
      ],
      activities: [
        {
          activityId: CURRENT_ACTIVITY,
          activityName: "Current activity",
          status: "green",
          linkedProducts: [
            { productId: LINKED_PRODUCT_A, productName: "Alpha" },
            { productId: LINKED_PRODUCT_B, productName: "Beta" },
          ],
        },
      ],
      items: [
        item({
          id: "10000000-0000-4000-8000-000000000030",
          stableId: STABLE_CONTINUED,
          projectId: CURRENT_PRODUCT,
          type: "current",
          text: "Continued delivery",
        }),
        item({
          id: "10000000-0000-4000-8000-000000000031",
          stableId: STABLE_UNPLANNED,
          activityId: CURRENT_ACTIVITY,
          type: "current",
          text: "Unplanned support",
        }),
      ],
    });
    const previousSection = {
      ...makeReportSectionFixture({
        projects: [
          {
            projectId: CURRENT_PRODUCT,
            projectName: "Current product",
            trafficLight: "green",
          },
          {
            projectId: HISTORICAL_PRODUCT,
            projectName: "Retired product",
            trafficLight: "yellow",
          },
        ],
        activities: [
          {
            activityId: CURRENT_ACTIVITY,
            activityName: "Current activity",
            status: "green",
          },
          {
            activityId: HISTORICAL_ACTIVITY,
            activityName: "Former duty",
            status: "red",
          },
        ],
        items: [
          item({
            id: "10000000-0000-4000-8000-000000000032",
            stableId: STABLE_CONTINUED,
            projectId: CURRENT_PRODUCT,
            type: "next",
            text: "Agreed delivery",
          }),
          item({
            id: "10000000-0000-4000-8000-000000000033",
            stableId: "10000000-0000-4000-8000-000000000022",
            projectId: HISTORICAL_PRODUCT,
            type: "next",
            text: "Historical commitment",
          }),
          item({
            id: "10000000-0000-4000-8000-000000000034",
            stableId: "10000000-0000-4000-8000-000000000023",
            activityId: HISTORICAL_ACTIVITY,
            type: "next",
            text: "Historical duty",
          }),
        ],
      }),
      status: "submitted" as const,
    };

    const result = projectStatusOverview(
      {
        current: {
          reportId: currentSection.reportId,
          periodStart: new Date("2026-08-31T00:00:00.000Z"),
          periodEnd: new Date("2026-09-06T00:00:00.000Z"),
          section: currentSection,
        },
        predecessor: {
          availability: "available",
          source: "submitted",
          reportId: previousSection.reportId,
          periodStart: new Date("2026-08-24T00:00:00.000Z"),
          periodEnd: new Date("2026-08-30T00:00:00.000Z"),
          section: previousSection,
        },
      },
      { currentItemsEditable: true },
    );

    expect(result.units.map((unit) => [unit.kind, unit.name])).toEqual([
      ["product", "Current product"],
      ["product", "Retired product"],
      ["activity", "Current activity"],
      ["activity", "Former duty"],
    ]);
    expect(
      result.units.filter((unit) => unit.id === CURRENT_ACTIVITY),
    ).toHaveLength(1);
    expect(result.units[2]?.linkedProducts).toEqual(["Alpha", "Beta"]);
    expect(result.units[1]?.historical).toBe(true);
    expect(result.units[3]?.historical).toBe(true);
    expect(result.units[0]?.columns.currentWeek.items[0]?.continuity).toBe(
      "continued",
    );
    expect(result.units[0]?.columns.currentWeek.items[0]).toMatchObject({
      recordId: "10000000-0000-4000-8000-000000000030",
      source: "current",
      editTarget: {
        recordId: "10000000-0000-4000-8000-000000000030",
        source: "current",
      },
    });
    expect(
      result.units[0]?.columns.previouslyPlanned.items[0]?.editTarget,
    ).toBeNull();
    expect(result.units[2]?.columns.currentWeek.items[0]?.continuity).toBe(
      "unplanned",
    );
    expect(result.sourceCounts).toEqual({
      previouslyPlanned: 3,
      currentWeek: 2,
      nextWeek: 0,
    });
    expect(
      result.units.reduce(
        (count, unit) => count + unit.columns.previouslyPlanned.items.length,
        0,
      ),
    ).toBe(result.sourceCounts.previouslyPlanned);
    expect(
      result.units.reduce(
        (count, unit) => count + unit.columns.currentWeek.items.length,
        0,
      ),
    ).toBe(result.sourceCounts.currentWeek);
    expect(
      result.units.reduce(
        (count, unit) => count + unit.columns.nextWeek.items.length,
        0,
      ),
    ).toBe(result.sourceCounts.nextWeek);
  });

  it("derives product health from risk-floored owned stages without activity bleed", () => {
    const currentSection = makeReportSectionFixture({
      projects: [
        {
          projectId: CURRENT_PRODUCT,
          projectName: "Payments",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: "10000000-0000-4000-8000-000000000040",
              stageName: "Development",
              sortOrder: 0,
              status: "green",
            },
          ],
        },
      ],
      activities: [
        {
          activityId: CURRENT_ACTIVITY,
          activityName: "Incident duty",
          status: "green",
          derivedStatus: "red",
        },
      ],
      risks: [
        {
          id: "10000000-0000-4000-8000-000000000041",
          stableId: "10000000-0000-4000-8000-000000000042",
          projectId: CURRENT_PRODUCT,
          risk: "Vendor delay",
          impact: "Release delay",
          mitigation: "Escalate",
          severity: "at-risk",
          stageNames: ["Development"],
        },
      ],
    });

    const result = projectStatusOverview({
      current: {
        reportId: currentSection.reportId,
        periodStart: new Date("2026-08-31T00:00:00.000Z"),
        periodEnd: new Date("2026-09-06T00:00:00.000Z"),
        section: currentSection,
      },
      predecessor: {
        availability: "unavailable",
        reason: "no_predecessor",
      },
    });

    expect(result.units[0]).toMatchObject({
      kind: "product",
      status: "at-risk",
      stages: [{ name: "Development", status: "at-risk" }],
    });
    expect(result.units[1]).toMatchObject({
      kind: "activity",
      status: "blocked",
    });
    expect(result.units[0]?.status).not.toBe(result.units[1]?.status);
    expect(result.units[0]?.columns.previouslyPlanned).toEqual({
      availability: "unavailable",
      reason: "No previous reporting period",
      items: [],
    });
    expect(result.periods).toEqual({
      previouslyPlanned: null,
      currentWeek: "Aug 31–Sep 6, 2026",
      nextWeek: "Sep 7–13, 2026",
    });
  });

  it("projects current items from the live editor draft and keeps read-only items inert", () => {
    const serverSection = makeReportSectionFixture({
      projects: [
        {
          projectId: CURRENT_PRODUCT,
          projectName: "Payments",
          trafficLight: "green",
        },
      ],
      items: [
        item({
          id: "10000000-0000-4000-8000-000000000050",
          stableId: STABLE_CONTINUED,
          projectId: CURRENT_PRODUCT,
          type: "current",
          text: "Server text",
        }),
      ],
    });
    const liveDraft = {
      ...serverSection,
      items: serverSection.items.map((entry) => ({
        ...entry,
        text: "Unsaved editor text",
      })),
    };
    const output = {
      current: {
        reportId: serverSection.reportId,
        periodStart: new Date("2026-08-31T00:00:00.000Z"),
        periodEnd: new Date("2026-09-06T00:00:00.000Z"),
        section: serverSection,
      },
      predecessor: {
        availability: "unavailable" as const,
        reason: "no_predecessor" as const,
      },
    };

    const editable = projectStatusOverview(output, {
      currentSection: liveDraft,
      currentItemsEditable: true,
    });
    const readOnly = projectStatusOverview(output, {
      currentSection: liveDraft,
      currentItemsEditable: false,
    });

    expect(editable.units[0]?.columns.currentWeek.items[0]?.text).toBe(
      "Unsaved editor text",
    );
    expect(
      editable.units[0]?.columns.currentWeek.items[0]?.editTarget,
    ).not.toBeNull();
    expect(
      readOnly.units[0]?.columns.currentWeek.items[0]?.editTarget,
    ).toBeNull();
  });
});
