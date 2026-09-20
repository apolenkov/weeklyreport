import { describe, expect, it } from "vitest";

import {
  applyRiskAlarmOverlay,
  deriveHeadItemStatus,
  deriveItemStatus,
  itemStatusToWorkflow,
  type ItemWorkflowStatus,
  persistableItemStatusToWorkflow,
  workflowToItemStatus,
} from "./item-status";

const BLOCKING_RISK = {
  productId: "product-1",
  stageNames: ["Development"],
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

  it("reads 'in_progress' as 'in-progress' for a current-week item", () => {
    expect(
      deriveItemStatus({ workflowStatus: "in_progress", type: "current" }),
    ).toBe("in-progress");
  });
});

describe("risk overlay", () => {
  it("floors an in-progress base status to blocked", () => {
    expect(
      applyRiskAlarmOverlay(
        "in-progress",
        { projectId: "product-1", stageNames: ["Development"] },
        [BLOCKING_RISK],
      ),
    ).toBe("blocked");
  });

  it("floors an in-progress base status to at-risk for a covering at-risk risk", () => {
    expect(
      applyRiskAlarmOverlay(
        "in-progress",
        { projectId: "product-1", stageNames: ["Development"] },
        [{ ...BLOCKING_RISK, severity: "at-risk" }],
      ),
    ).toBe("at-risk");
  });

  it("lets a covering blocked risk outrank a covering at-risk risk", () => {
    expect(
      applyRiskAlarmOverlay(
        "in-progress",
        { projectId: "product-1", stageNames: ["Development"] },
        [{ ...BLOCKING_RISK, severity: "at-risk" }, BLOCKING_RISK],
      ),
    ).toBe("blocked");
  });

  it("returns the base status when no risk covers the item", () => {
    expect(
      applyRiskAlarmOverlay(
        "in-progress",
        { projectId: "product-1", stageNames: ["Development"] },
        [],
      ),
    ).toBe("in-progress");
    expect(
      applyRiskAlarmOverlay(
        "in-progress",
        { projectId: "product-2", stageNames: ["Development"] },
        [BLOCKING_RISK],
      ),
    ).toBe("in-progress");
    expect(
      applyRiskAlarmOverlay(
        "in-progress",
        { projectId: "product-1", stageNames: ["Testing"] },
        [BLOCKING_RISK],
      ),
    ).toBe("in-progress");
    expect(
      applyRiskAlarmOverlay(
        "in-progress",
        { projectId: "product-1", stageNames: ["Development"] },
        [{ ...BLOCKING_RISK, text: " ".repeat(3) }],
      ),
    ).toBe("in-progress");
  });

  it.each(["planned", "completed", "paused", "postponed"] as const)(
    "keeps a non-in-progress base '%s' unchanged under a covering risk",
    (base) => {
      expect(
        applyRiskAlarmOverlay(
          base,
          { projectId: "product-1", stageNames: ["Development"] },
          [BLOCKING_RISK],
        ),
      ).toBe(base);
    },
  );

  it("derives the head status from stored progress and covering risks", () => {
    expect(
      deriveHeadItemStatus(
        {
          workflowStatus: "in_progress",
          type: "current",
          projectId: "product-1",
          stageNames: ["Development"],
        },
        [BLOCKING_RISK],
      ),
    ).toBe("blocked");
  });

  it("derives the head at-risk status from a covering at-risk risk", () => {
    expect(
      deriveHeadItemStatus(
        {
          workflowStatus: "in_progress",
          type: "next",
          projectId: "product-1",
          stageNames: ["Development"],
        },
        [{ ...BLOCKING_RISK, severity: "at-risk" }],
      ),
    ).toBe("at-risk");
  });
});

describe("persistableItemStatusToWorkflow", () => {
  it.each(["blocked", "at-risk"] as const)(
    "persists the display alarm '%s' as in_progress",
    (status) => {
      expect(persistableItemStatusToWorkflow(status)).toBe("in_progress");
    },
  );

  it.each([
    "planned",
    "in-progress",
    "paused",
    "postponed",
    "completed",
  ] as const)("persists the progress status '%s' unchanged", (status) => {
    expect(persistableItemStatusToWorkflow(status)).toBe(
      itemStatusToWorkflow(status),
    );
  });
});
