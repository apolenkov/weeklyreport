// Bridges stored ItemWorkflowStatus with UI ItemStatus. Stored enum is the
// sole progress source: no completed flag, no stored blocked. `blocked` is a
// covering-risk display overlay only — never settable or persistable.

import type { ItemWorkflowStatus } from "@customreport/shared";

import {
  type AlarmRisk,
  deriveItemAlarmFromRisks,
} from "../../../lib/item-alarm";

const IN_PROGRESS_STATUS = "in-progress";

export type { ItemWorkflowStatus } from "@customreport/shared";
export type ItemType = "current" | "next";
export type ItemStatus =
  "in-progress" | "completed" | "planned" | "paused" | "postponed" | "blocked";

// Never produces 'blocked' — that is the risk-derived overlay only.
export function workflowToItemStatus(
  ws: ItemWorkflowStatus,
): Exclude<ItemStatus, "blocked"> {
  switch (ws) {
    case "done":
      return "completed";
    case "in_progress":
      return IN_PROGRESS_STATUS;
    case "planned":
      return "planned";
    case "paused":
      return "paused";
    case "postponed":
      return "postponed";
  }
}

// 'blocked' excluded at the type level (a blocker is a risk, never an item status).
export function itemStatusToWorkflow(
  status: Exclude<ItemStatus, "blocked">,
): ItemWorkflowStatus {
  switch (status) {
    case "completed":
      return "done";
    case IN_PROGRESS_STATUS:
      return "in_progress";
    case "planned":
      return "planned";
    case "paused":
      return "paused";
    case "postponed":
      return "postponed";
  }
}

// Save path: 'blocked' is the covering-risk overlay, so what persists is the
// progress underneath it — in-progress.
export function persistableItemStatusToWorkflow(
  status: ItemStatus,
): ItemWorkflowStatus {
  return itemStatusToWorkflow(
    status === "blocked" ? IN_PROGRESS_STATUS : status,
  );
}

// Stored progress, with a type-appropriate default for legacy rows missing status.
export function deriveItemStatus(item: {
  workflowStatus: ItemWorkflowStatus | null;
  type: ItemType;
}): ItemStatus {
  if (item.workflowStatus) return workflowToItemStatus(item.workflowStatus);
  return item.type === "next" ? "planned" : IN_PROGRESS_STATUS;
}

// Covering-risk BLOCKED overlay on a base progress status — same rule as the
// lead card. Only in-progress is eligible; at-risk amber stays deferred on head.
export function applyBlockedRiskOverlay(
  base: ItemStatus,
  parent: { projectId: string; stageNames?: readonly string[] | null },
  alarmRisks: readonly AlarmRisk[],
): ItemStatus {
  const covered = deriveItemAlarmFromRisks(
    {
      productId: parent.projectId,
      stageNames: parent.stageNames ?? undefined,
      status: base,
    },
    alarmRisks,
  );
  return covered === "blocked" ? "blocked" : base;
}

// Head-report badge: progress status with the blocked overlay applied.
export function deriveHeadItemStatus(
  item: {
    workflowStatus: ItemWorkflowStatus | null;
    type: ItemType;
    projectId: string;
    stageNames?: readonly string[] | null;
  },
  alarmRisks: readonly AlarmRisk[],
): ItemStatus {
  return applyBlockedRiskOverlay(deriveItemStatus(item), item, alarmRisks);
}
