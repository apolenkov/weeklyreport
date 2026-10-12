import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import type { KanbanItem } from "../../report-sections";
import { applySlideInlineItemEdit } from "./slide-inline-draft";

function sectionWithItem(nextStepText: string | null): ReportSectionReadModel {
  return {
    reportSectionId: "s-1",
    items: [
      {
        id: "i-1",
        stableId: "st-1",
        type: "current",
        text: "Old",
        tag: "feature",
        workflowStatus: "in_progress",
        carriedOver: false,
        nextStepText,
        stageNames: [],
        priorityRank: 1,
        projectId: "p-1",
        activityId: null,
      },
    ],
  } as unknown as ReportSectionReadModel;
}

function kanbanItem(
  status: KanbanItem["status"],
  nextStepText: string,
): KanbanItem {
  return {
    id: "i-1",
    status,
    text: "New",
    productId: "p-1",
    activityId: null,
    stageNames: [],
    priorityRank: 1,
    nextStepText,
  } as unknown as KanbanItem;
}

describe("applySlideInlineItemEdit next-step handling", () => {
  it("carries an edited next step into the section", () => {
    const next = applySlideInlineItemEdit(
      sectionWithItem("Old step"),
      "st-1",
      kanbanItem("in-progress", "New step"),
    );

    expect(next.items[0]?.nextStepText).toBe("New step");
  });

  it("clears the next step when the edited row is completed", () => {
    const next = applySlideInlineItemEdit(
      sectionWithItem("Old step"),
      "st-1",
      kanbanItem("completed", "New step"),
    );

    expect(next.items[0]?.nextStepText).toBeNull();
  });
});
