import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { planCarriedEntries } from "./carry-over-plan";

type Item = ReportSectionReadModel["items"][number];
const stableId = "10000000-0000-4000-8000-000000000001";
const projectId = "10000000-0000-4000-8000-000000000002";
const sourceReportId = "10000000-0000-4000-8000-000000000004";
const targetReportId = "10000000-0000-4000-8000-000000000005";
const current: Item = {
  id: "10000000-0000-4000-8000-000000000003",
  stableId,
  projectId,
  type: "current",
  text: "Current result",
  nextStepText: "Verify production",
  workflowStatus: "in_progress",
  tag: "delivery",
  stageNames: ["Development"],
  carriedOver: false,
};
function section(
  items: readonly Item[],
  reportId: string,
): ReportSectionReadModel {
  return {
    reportId,
    reportSectionId: reportId,
    authorId: "lead",
    projects: [{ projectId }],
    activities: [],
    decisions: [],
    items,
  } as unknown as ReportSectionReadModel;
}
const context = {
  sourceReportId,
  targetReportId,
  carriedAt: new Date("2026-10-26T00:00:00Z"),
};

describe("Overview continuation preserves valid W+1 lineage", () => {
  it("carries one Current with a linked next step once, preserving the previous result", () => {
    const source = section([current], sourceReportId);
    const snapshot = structuredClone(source);
    const result = planCarriedEntries(
      [source],
      [section([], targetReportId)],
      context,
    );
    const carried = result.flatMap((entry) =>
      entry.items.map((row) => row.item),
    );
    expect(carried).toHaveLength(1);
    expect(carried[0]).toMatchObject({
      stableId,
      type: "current",
      text: "Verify production",
      workflowStatus: "planned",
      nextStepText: null,
    });
    expect(source).toEqual(snapshot);
    expect(
      planCarriedEntries(
        [source],
        [section(carried, targetReportId)],
        context,
      ).flatMap((entry) => entry.items),
    ).toHaveLength(0);
  });
  it("preserves an explicit W+1 occurrence instead of duplicating an unfinished Current", () => {
    const source = section(
      [{ ...current, nextStepText: null }],
      sourceReportId,
    );
    const winner: Item = {
      ...current,
      id: "10000000-0000-4000-8000-000000000006",
      type: "next",
      text: "Explicit W+1 plan",
      workflowStatus: "planned",
      nextStepText: null,
    };
    // Each section has exactly one row for stableId; separate periods may share it.
    const target = section([winner], targetReportId);
    const snapshot = structuredClone(target);
    expect(
      planCarriedEntries([source], [target], context).flatMap(
        (entry) => entry.items,
      ),
    ).toHaveLength(0);
    expect(target).toEqual(snapshot);
    expect(target.items.filter((row) => row.stableId === stableId)).toEqual([
      winner,
    ]);
  });
});
