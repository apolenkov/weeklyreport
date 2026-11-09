import type { RecordCommentView } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import { projectStatusOverview } from "./status-overview";

const PROJECT = "10000000-0000-4000-8000-000000000001";
const RECORD = "10000000-0000-4000-8000-000000000002";
const LINEAGE = "10000000-0000-4000-8000-000000000003";

function sectionWithComment(text: string) {
  const comment: RecordCommentView = {
    id: "10000000-0000-4000-8000-000000000004",
    reviewerId: "10000000-0000-4000-8000-000000000005",
    text,
    createdAt: new Date("2026-08-31T12:00:00Z"),
  };
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
        text: "Source item",
        nextStepText: "Next commitment",
        workflowStatus: "in_progress",
        carriedOver: false,
        tag: "delivery",
        stageNames: [],
        comments: [comment],
      },
    ],
  });
}

function output(section: ReturnType<typeof sectionWithComment>) {
  return {
    current: {
      reportId: section.reportId,
      periodStart: new Date("2026-08-31T00:00:00Z"),
      periodEnd: new Date("2026-09-06T00:00:00Z"),
      section,
    },
    predecessor: {
      availability: "unavailable",
      reason: "no_predecessor",
    },
  } as const;
}

describe("discussion source boundary (F2 regression)", () => {
  it("does not use dirty comment A instead of authoritative read-only B", () => {
    const authoritative = sectionWithComment("B: authorized source");
    const draft = sectionWithComment("A: stale dirty discussion");
    const before = JSON.stringify(draft);
    const model = projectStatusOverview(output(authoritative), {
      currentSection: draft,
      currentItemsEditable: false,
    });

    // The current host has no source discriminator. This pins the required
    // separation without making readOnly itself evidence of a snapshot.
    expect(JSON.stringify(draft)).toBe(before);
    expect(model.units[0]?.columns.currentWeek.items[0]?.comments).toEqual(
      authoritative.items[0]?.comments,
    );
  });

  it("does not turn the derived read-only Next discussion into an empty list", () => {
    const authoritative = sectionWithComment("B: authorized source");
    const model = projectStatusOverview(output(authoritative), {
      currentItemsEditable: false,
    });
    const current = model.units[0]?.columns.currentWeek.items[0];
    const next = model.units[0]?.columns.nextWeek.items[0];

    expect(next?.recordId).toBe(current?.recordId);
    expect(next?.stableId).toBe(current?.stableId);
    expect(next?.comments).toEqual(authoritative.items[0]?.comments);
  });
});
