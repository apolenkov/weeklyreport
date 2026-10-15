import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { makeReportSectionReadModel } from "../../test-utils/report-section-fixtures.js";
import { mergeCarriedIntoTargets } from "./carry-over-plan.js";

// TASK-503.108: U+2060 alone passed the earlier write rule; the current write
// rule rejects it. Carry-over copies stored rows and must keep them exactly.
const LEGACY = "⁠";
const ACTIVITY_ID = "10000000-0000-4000-8000-000000000005";

const storedItem = (
  id: string,
  stableId: string,
): ReportSectionReadModel["items"][number] => ({
  id,
  stableId,
  projectId: null,
  activityId: ACTIVITY_ID,
  stageNames: [],
  type: "current",
  text: LEGACY,
  tag: LEGACY,
  workflowStatus: "in_progress",
  carriedOver: false,
  pausedReason: null,
  nextStepText: null,
});
const storedDecision: ReportSectionReadModel["decisions"][number] = {
  id: "10800000-0000-4000-8000-000000000021",
  stableId: "10800000-0000-4000-8000-000000000022",
  productId: null,
  activityId: ACTIVITY_ID,
  stageNames: [],
  text: LEGACY,
  owner: "Test Lead",
  impact: LEGACY,
};

describe("mergeCarriedIntoTargets over stored text the write rule now rejects", () => {
  it("keeps the target's stored rows and the carried rows exactly", () => {
    const targetItem = storedItem(
      "10800000-0000-4000-8000-000000000023",
      "10800000-0000-4000-8000-000000000024",
    );
    const carriedItem = {
      ...storedItem(
        "10800000-0000-4000-8000-000000000025",
        "10800000-0000-4000-8000-000000000026",
      ),
      carriedOver: true,
    };
    const target = makeReportSectionReadModel({
      items: [targetItem],
      decisions: [storedDecision],
    });

    const [merged] = mergeCarriedIntoTargets(
      [target],
      [
        {
          authorId: target.authorId,
          items: [{ item: carriedItem, record: {} as never }],
          decisions: [],
        },
      ],
    );

    expect(merged?.items).toEqual([targetItem, carriedItem]);
    expect(merged?.decisions).toEqual([storedDecision]);
  });
});
