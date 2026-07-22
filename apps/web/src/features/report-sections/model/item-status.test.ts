import { describe, expect, it } from "vitest";

import {
  applyBlockedRiskOverlay,
  deriveHeadItemStatus,
  deriveItemStatus,
  itemStatusToWorkflow,
  type ItemWorkflowStatus,
  workflowToItemStatus,
} from "./item-status";

const BLOCKING_RISK = {
  productId: "product-1",
  stageIds: ["Development"],
  severity: "blocked" as const,
  text: "Release is blocked",
};

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

describe("stored blocked is unrepresentable", () => {
  const ALL_WORKFLOW: readonly ItemWorkflowStatus[] = [
    "planned",
    "in_progress",
    "paused",
    "postponed",
    "done",
  ];

  it.each(ALL_WORKFLOW)(
    "workflowToItemStatus('%s') never yields the risk-derived 'blocked'",
    (workflowStatus) => {
      expect(workflowToItemStatus(workflowStatus)).not.toBe("blocked");
    },
  );

  it.each(ALL_WORKFLOW)(
    "deriveItemStatus never yields 'blocked' for '%s' on either week",
    (workflowStatus) => {
      expect(deriveItemStatus({ workflowStatus, type: "current" })).not.toBe(
        "blocked",
      );
      expect(deriveItemStatus({ workflowStatus, type: "next" })).not.toBe(
        "blocked",
      );
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

describe("risk overlay", () => {
  it("floors an in-progress base status to blocked", () => {
    expect(
      applyBlockedRiskOverlay(
        "in-progress",
        { projectId: "product-1", stageIds: ["Development"] },
        [BLOCKING_RISK],
      ),
    ).toBe("blocked");
  });

  it("leaves the base status unchanged for an at-risk covering risk", () => {
    expect(
      applyBlockedRiskOverlay(
        "in-progress",
        { projectId: "product-1", stageIds: ["Development"] },
        [{ ...BLOCKING_RISK, severity: "at-risk" }],
      ),
    ).toBe("in-progress");
  });

  it("derives the head status from stored progress and covering risks", () => {
    expect(
      deriveHeadItemStatus(
        {
          workflowStatus: "in_progress",
          type: "current",
          projectId: "product-1",
          stageIds: ["Development"],
        },
        [BLOCKING_RISK],
      ),
    ).toBe("blocked");
  });
});
