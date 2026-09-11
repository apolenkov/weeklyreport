import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import { projectReportHealthPulse } from "./report-health-pulse";
import type { StatusOverviewUnit } from "./status-overview";

const PRODUCT_A = "10000000-0000-4000-8000-000000000010";
const PRODUCT_B = "10000000-0000-4000-8000-000000000011";
const ACTIVITY = "10000000-0000-4000-8000-000000000012";

function unit(
  overrides: Partial<StatusOverviewUnit> &
    Pick<StatusOverviewUnit, "id" | "kind" | "name">,
): StatusOverviewUnit {
  const kind = overrides.kind;
  return {
    key: `${kind}:${overrides.id}`,
    historical: false,
    status: "on-track",
    stages: [],
    linkedProducts: [],
    columns: {
      previouslyPlanned: { availability: "available", items: [] },
      currentWeek: { availability: "available", items: [] },
      nextWeek: { availability: "available", items: [] },
    },
    ...overrides,
  };
}

describe("projectReportHealthPulse", () => {
  it("counts null and partial product stages as missing independently", () => {
    const section = makeReportSectionFixture();
    const result = projectReportHealthPulse(
      [
        unit({
          id: PRODUCT_A,
          kind: "product",
          name: "Blocked but partial",
          status: "blocked",
          stages: [
            { name: "Discovery", status: "blocked" },
            { name: "Development", status: "empty" },
          ],
        }),
        unit({
          id: PRODUCT_B,
          kind: "product",
          name: "Missing only",
          stages: [{ name: "Testing", status: "empty" }],
        }),
      ],
      section,
    );

    expect(result).toMatchObject({
      blocked: 1,
      atRisk: 0,
      missing: 2,
      total: 2,
    });
    expect(result.units.map((entry) => entry.name)).toEqual([
      "Blocked but partial",
      "Missing only",
    ]);
    expect(result.units[0]?.missingStages).toEqual(["Development"]);
    expect(result.units[1]?.missingStages).toEqual(["Testing"]);
  });

  it("scopes product risks to owned stages and never leaks activity risks", () => {
    const section = makeReportSectionFixture({
      risks: [
        {
          id: "10000000-0000-4000-8000-000000000020",
          projectId: PRODUCT_A,
          risk: "Vendor delay",
          impact: "Release slips",
          mitigation: "Escalate",
          severity: "at-risk",
          stageNames: ["Development", "Testing"],
        },
        {
          id: "10000000-0000-4000-8000-000000000021",
          projectId: PRODUCT_B,
          risk: "Other product",
          impact: "None here",
          mitigation: "Track elsewhere",
          severity: "blocked",
          stageNames: ["Development"],
        },
        {
          id: "10000000-0000-4000-8000-000000000022",
          activityId: ACTIVITY,
          risk: "Duty overload",
          impact: "Slow response",
          mitigation: "Add rotation",
          severity: "blocked",
          stageNames: [],
        },
      ],
    });

    const result = projectReportHealthPulse(
      [
        unit({
          id: PRODUCT_A,
          kind: "product",
          name: "Payments",
          status: "at-risk",
          stages: [{ name: "Development", status: "at-risk" }],
        }),
      ],
      section,
    );

    expect(result.units[0]?.risks).toEqual([
      {
        id: "10000000-0000-4000-8000-000000000020",
        description: "Vendor delay",
        impact: "Release slips",
        mitigation: "Escalate",
        locations: ["Development"],
        severity: "at-risk",
      },
    ]);
  });

  it("re-derives activity health from local risks and ignores stale derivedStatus", () => {
    const section = makeReportSectionFixture({
      activities: [
        {
          activityId: ACTIVITY,
          activityName: "Incident duty",
          status: "green",
          derivedStatus: "green",
        },
      ],
      risks: [
        {
          id: "10000000-0000-4000-8000-000000000023",
          activityId: ACTIVITY,
          risk: "Coverage gap",
          impact: "Delayed response",
          mitigation: "Add backup",
          severity: "blocked",
          stageNames: [],
        },
      ],
    });

    const result = projectReportHealthPulse(
      [
        unit({
          id: ACTIVITY,
          kind: "activity",
          name: "Incident duty",
          status: "on-track",
        }),
      ],
      section,
    );

    expect(result).toMatchObject({ blocked: 1, missing: 0, total: 1 });
    expect(result.units[0]).toMatchObject({
      status: "blocked",
      stages: [],
      missingStages: [],
      risks: [
        {
          description: "Coverage gap",
          locations: [],
          severity: "blocked",
        },
      ],
    });
  });

  it("counts an activity without stages or a selected status as missing", () => {
    const section = makeReportSectionFixture({
      activities: [
        {
          activityId: ACTIVITY,
          activityName: "Unassessed duty",
          status: null,
          derivedStatus: "red",
        },
      ],
    });

    const result = projectReportHealthPulse(
      [
        unit({
          id: ACTIVITY,
          kind: "activity",
          name: "Unassessed duty",
          status: "blocked",
        }),
      ],
      section,
    );

    expect(result).toMatchObject({ blocked: 0, missing: 1, total: 1 });
    expect(result.units[0]).toMatchObject({
      status: "empty",
      stages: [],
      missingStages: [],
    });
  });

  it("retains historical detail but excludes it and its current risks from totals", () => {
    const section = makeReportSectionFixture({
      risks: [
        {
          id: "10000000-0000-4000-8000-000000000024",
          projectId: PRODUCT_A,
          risk: "Current reused identifier risk",
          impact: "Wrong history",
          mitigation: "Do not attach",
          severity: "blocked",
          stageNames: ["Testing"],
        },
      ],
    });
    const result = projectReportHealthPulse(
      [
        unit({
          id: PRODUCT_A,
          kind: "product",
          name: "Historical product",
          historical: true,
          status: "blocked",
          stages: [{ name: "Testing", status: "empty" }],
        }),
      ],
      section,
    );

    expect(result).toMatchObject({
      blocked: 0,
      atRisk: 0,
      missing: 0,
      total: 0,
    });
    expect(result.units[0]).toMatchObject({
      historical: true,
      status: "blocked",
      missingStages: ["Testing"],
      risks: [],
    });
  });

  it("orders problem categories first while preserving order within each group", () => {
    const section = makeReportSectionFixture();
    const result = projectReportHealthPulse(
      [
        unit({ id: PRODUCT_A, kind: "product", name: "Healthy first" }),
        unit({
          id: PRODUCT_B,
          kind: "product",
          name: "Missing",
          stages: [{ name: "Testing", status: "empty" }],
        }),
        unit({
          id: ACTIVITY,
          kind: "activity",
          name: "At risk",
          status: "at-risk",
          historical: true,
        }),
      ],
      section,
    );

    expect(result.units.map((entry) => entry.name)).toEqual([
      "At risk",
      "Missing",
      "Healthy first",
    ]);
  });
});
