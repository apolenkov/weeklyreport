import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { promoteItemTransition } from "../report-sections/domain/item-outcome-transition";
import { planCarriedEntries } from "./carry-over-plan";

type Item = ReportSectionReadModel["items"][number];
const stableId = "10000000-0000-4000-8000-000000000001";
const projectId = "10000000-0000-4000-8000-000000000002";
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
function section(items: readonly Item[]): ReportSectionReadModel {
  return {
    authorId: "lead",
    projects: [{ projectId }],
    activities: [],
    decisions: [],
    items,
  } as unknown as ReportSectionReadModel;
}

describe("Overview Plan for next week preserves W+1 lineage", () => {
  it.each([false, true])(
    "creates exactly one active W+1 occurrence and explicit Next wins (reversed: %s)",
    (reverse) => {
      const transition = promoteItemTransition(current, "next");
      const next = { ...current, ...transition.afterState };
      const fallback = {
        ...current,
        nextStepText: null,
        text: "Unfinished Current fallback",
      };
      const items = reverse ? [next, fallback] : [fallback, next];
      const source = section(items);
      const snapshot = structuredClone(source);
      const target = section([]);
      const result = planCarriedEntries([source], [target], {
        sourceReportId: "10000000-0000-4000-8000-000000000004",
        targetReportId: "10000000-0000-4000-8000-000000000005",
        carriedAt: new Date("2026-10-26T00:00:00Z"),
      });
      const carried = result.flatMap((entry) =>
        entry.items.map((row) => row.item),
      );
      expect(carried.filter((row) => row.stableId === stableId)).toHaveLength(
        1,
      );
      expect(carried[0]).toMatchObject({
        stableId,
        type: "current",
        text: "Verify production",
        workflowStatus: "planned",
        nextStepText: null,
      });
      expect(source).toEqual(snapshot);
      expect(transition.beforeState).toMatchObject({
        text: "Current result",
        nextStepText: "Verify production",
      });
      // Replaying rollover after W+1 already holds this lineage creates nothing.
      expect(
        planCarriedEntries([source], [section(carried)], {
          sourceReportId: "10000000-0000-4000-8000-000000000004",
          targetReportId: "10000000-0000-4000-8000-000000000005",
          carriedAt: new Date("2026-10-26T00:00:00Z"),
        }).flatMap((entry) => entry.items),
      ).toHaveLength(0);
    },
  );
});
