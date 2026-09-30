import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import {
  projectStatusOverview,
  type StatusOverviewProjectionSource,
} from "./status-overview";
import { buildStatusOverviewColumns } from "./status-overview-items";
import { buildStatusOverviewLineage } from "./status-overview-lineage";

const PROJECT = "10000000-0000-4000-8000-000000000001";
const RECORD = "10000000-0000-4000-8000-000000000002";
const LINEAGE = "10000000-0000-4000-8000-000000000003";

function section() {
  return makeReportSectionFixture({
    projects: [
      { projectId: PROJECT, projectName: "Portal", trafficLight: "green" },
    ],
    items: [
      {
        id: RECORD,
        stableId: LINEAGE,
        projectId: PROJECT,
        type: "current",
        text: "API implemented",
        nextStepText: "Run integration tests",
        workflowStatus: "in_progress",
        carriedOver: true,
        tag: "delivery",
        stageNames: ["Development"],
      },
    ],
  });
}

function input(): StatusOverviewProjectionSource {
  return {
    currentSection: section(),
    previousPlan: { availability: "unavailable", reason: "No previous period" },
    periods: {
      previouslyPlanned: null,
      currentWeek: "Current",
      nextWeek: "Next",
    },
    currentItemsEditable: true,
  };
}

describe("next-step overview projection", () => {
  it("shows the result and next step without duplicating the persisted task", () => {
    const source = section();
    const model = projectStatusOverview(
      {
        current: {
          reportId: source.reportId,
          periodStart: new Date("2026-08-31"),
          periodEnd: new Date("2026-09-06"),
          section: source,
        },
        predecessor: { availability: "unavailable", reason: "no_predecessor" },
      },
      { currentItemsEditable: true },
    );
    const rows = buildStatusOverviewLineage(model.units).get(
      `product:${PROJECT}`,
    );
    expect(source.items).toHaveLength(1);
    expect(rows).toHaveLength(1);
    expect(rows?.[0]).toMatchObject({
      current: { text: "API implemented", workflowStatus: "in_progress" },
      next: {
        text: "Run integration tests",
        workflowStatus: "planned",
        editTarget: { recordId: RECORD, source: "current" },
      },
    });
    expect(model.sourceCounts).toEqual({
      previouslyPlanned: 0,
      currentWeek: 1,
      nextWeek: 1,
    });
  });

  it("reads the prior commitment, not the prior result, from an immutable source", () => {
    const previous = section();
    const source = {
      ...input(),
      previousPlan: {
        availability: "available",
        source: "published",
        section: previous,
      },
    } as const;
    const columns = buildStatusOverviewColumns(
      "product",
      PROJECT,
      source,
      previous,
    );
    expect(columns.previouslyPlanned.items[0]).toMatchObject({
      text: "Run integration tests",
      editTarget: null,
    });
    expect(columns.currentWeek.items[0]?.continuity).toBe("continued");
    expect(previous.items[0]?.text).toBe("API implemented");
  });

  it("retains the visible pause instead of presenting a suspended next step as active", () => {
    const initial = input();
    const currentSection = {
      ...initial.currentSection,
      items: initial.currentSection.items.map((item) => ({
        ...item,
        workflowStatus: "paused" as const,
        pausedReason: "Waiting for access",
      })),
    };
    const columns = buildStatusOverviewColumns(
      "product",
      PROJECT,
      { ...initial, currentSection },
      null,
    );
    expect(columns.nextWeek.items[0]).toMatchObject({
      text: "Run integration tests",
      workflowStatus: "paused",
      pausedReason: "Waiting for access",
    });
  });
});
