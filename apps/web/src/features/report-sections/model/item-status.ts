// Bridges stored ItemWorkflowStatus with UI ItemStatus. Stored enum is the
// sole progress source: no completed flag, no stored blocked. `at-risk` and
// `blocked` are covering-risk display overlays only — never settable or
// persistable.

import type { ItemWorkflowStatus } from "@weeklyreport/shared";

import { type AlarmRisk, deriveItemAlarmFromRisks } from "./alarms/item-alarm";

const IN_PROGRESS_STATUS = "in-progress";

export type { ItemWorkflowStatus } from "@weeklyreport/shared";
export type ItemType = "current" | "next";
export type ItemProgressStatus =
  "in-progress" | "completed" | "planned" | "paused" | "postponed";
export type ItemStatus = ItemProgressStatus | "at-risk" | "blocked";

// Never produces an alarm — those are the risk-derived overlay only.
export function workflowToItemStatus(
  ws: ItemWorkflowStatus,
): ItemProgressStatus {
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

// Alarms excluded at the type level (a blocker is a risk, never an item status).
export function itemStatusToWorkflow(
  status: ItemProgressStatus,
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

// Save path: alarms are the covering-risk overlay, so what persists is the
// progress underneath them — in-progress.
export function persistableItemStatusToWorkflow(
  status: ItemStatus,
): ItemWorkflowStatus {
  return itemStatusToWorkflow(
    status === "blocked" || status === "at-risk" ? IN_PROGRESS_STATUS : status,
  );
}

export function deriveItemStatus(item: {
  workflowStatus: ItemWorkflowStatus;
  type: ItemType;
}): ItemStatus {
  return workflowToItemStatus(item.workflowStatus);
}

// Covering-risk alarm overlay on a base progress status — same rule as the
// lead card. Only in-progress is eligible; blocked outranks at-risk.
export function applyRiskAlarmOverlay(
  base: ItemStatus,
  parent: {
    projectId: string;
    stageNames: readonly string[];
  },
  alarmRisks: readonly AlarmRisk[],
): ItemStatus {
  const covered = deriveItemAlarmFromRisks(
    {
      productId: parent.projectId,
      stageNames: parent.stageNames,
      status: base,
    },
    alarmRisks,
  );
  return covered ?? base;
}

// Head-report badge: progress status with the risk-alarm overlay applied.
export function deriveHeadItemStatus(
  item: {
    workflowStatus: ItemWorkflowStatus;
    type: ItemType;
    projectId: string;
    stageNames: readonly string[];
  },
  alarmRisks: readonly AlarmRisk[],
): ItemStatus {
  return applyRiskAlarmOverlay(deriveItemStatus(item), item, alarmRisks);
}
