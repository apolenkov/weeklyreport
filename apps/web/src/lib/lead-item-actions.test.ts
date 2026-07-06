import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { markCompletePatch, moveToNextWeekPatch } from "./lead-item-actions";

type LeadItem = ReportSectionReadModel["items"][number];

function carriedItem(): LeadItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    stableId: "22222222-2222-4222-8222-222222222222",
    projectId: "33333333-3333-4333-8333-333333333333",
    type: "current",
    text: "Carried-in work",
    tag: "feature",
    workflowStatus: "in_progress",
    carriedOver: true,
  };
}

describe("moveToNextWeekPatch", () => {
  it("resets carriedOver so a carried item becomes a fresh deferral", () => {
    const patch = moveToNextWeekPatch();
    expect(patch).toEqual({
      type: "next",
      workflowStatus: "postponed",
      carriedOver: false,
    });
  });

  it("applied to a carried item yields type=next, workflowStatus=postponed, carriedOver=false", () => {
    const moved = { ...carriedItem(), ...moveToNextWeekPatch() };
    expect(moved.type).toBe("next");
    expect(moved.workflowStatus).toBe("postponed");
    expect(moved.carriedOver).toBe(false);
    // Durable identity is preserved — the published-lock and comment anchors
    // key on stableId, so the move must not touch it.
    expect(moved.stableId).toBe("22222222-2222-4222-8222-222222222222");
    expect(moved.id).toBe("11111111-1111-4111-8111-111111111111");
  });
});

describe("markCompletePatch", () => {
  it("marks the item done in place", () => {
    expect(markCompletePatch()).toEqual({
      workflowStatus: "done",
    });
  });
});
