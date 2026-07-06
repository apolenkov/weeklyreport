import { describe, expect, it } from "vitest";

import {
  deriveItemStatus,
  itemStatusToWorkflow,
  type ItemWorkflowStatus,
  workflowToItemStatus,
} from "./item-status";

const PROGRESS_PAIRS: readonly (readonly [
  ItemWorkflowStatus,
  ReturnType<typeof workflowToItemStatus>,
])[] = [
  ["done", "completed"],
  ["in_progress", "in-progress"],
  ["planned", "planned"],
  ["paused", "paused"],
  ["postponed", "postponed"],
];

describe("workflowToItemStatus / itemStatusToWorkflow round-trip", () => {
  it.each(PROGRESS_PAIRS)(
    "round-trips '%s' <-> '%s'",
    (workflowStatus, itemStatus) => {
      expect(workflowToItemStatus(workflowStatus)).toBe(itemStatus);
      expect(itemStatusToWorkflow(itemStatus)).toBe(workflowStatus);
    },
  );
});

describe("deriveItemStatus", () => {
  it("returns 'completed' for current item with workflowStatus 'done'", () => {
    expect(deriveItemStatus({ workflowStatus: "done", type: "current" })).toBe(
      "completed",
    );
  });

  it("computes 'planned' for a next-week item with no workflowStatus", () => {
    expect(deriveItemStatus({ workflowStatus: null, type: "next" })).toBe(
      "planned",
    );
  });

  it("reads 'planned' verbatim for a next-week item with workflowStatus 'planned'", () => {
    expect(deriveItemStatus({ workflowStatus: "planned", type: "next" })).toBe(
      "planned",
    );
  });

  it("reads 'postponed' verbatim for a next-week item with workflowStatus 'postponed'", () => {
    expect(
      deriveItemStatus({ workflowStatus: "postponed", type: "next" }),
    ).toBe("postponed");
  });

  it("reads 'paused' verbatim for a current-week item with workflowStatus 'paused'", () => {
    expect(
      deriveItemStatus({ workflowStatus: "paused", type: "current" }),
    ).toBe("paused");
  });

  it("preserves completed for next-week items", () => {
    expect(deriveItemStatus({ workflowStatus: "done", type: "next" })).toBe(
      "completed",
    );
  });

  it("returns 'in-progress' for current-week item with no workflowStatus", () => {
    expect(deriveItemStatus({ workflowStatus: null, type: "current" })).toBe(
      "in-progress",
    );
  });
});
