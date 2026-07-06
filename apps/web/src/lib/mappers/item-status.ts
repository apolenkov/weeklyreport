/**
 * Item-status mapper: bridges the stored ItemWorkflowStatus enum
 * (planned/in_progress/paused/postponed/done) with the UI ItemStatus.
 *
 * The stored enum is the single source of progress (rework-item-status-model):
 * no completed flag, no stored blocked. `blocked` exists in the UI union only
 * as the covering-risk DISPLAY overlay — it is never settable or persistable.
 */

import { type AlarmRisk, deriveItemAlarmFromRisks } from "../item-alarm";

const IN_PROGRESS_STATUS = "in-progress";

export type ItemWorkflowStatus =
  | "planned"
  | "in_progress"
  | "paused"
  | "postponed"
  | "done";
export type ItemType = "current" | "next";
export type ItemStatus =
  | "in-progress"
  | "completed"
  | "planned"
  | "paused"
  | "postponed"
  | "blocked";

/** Converts a stored ItemWorkflowStatus to its presentation ItemStatus.
 * Never produces 'blocked' — that is the risk-derived overlay only. */
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

/** Inverse mapping for settable presentation states — 'blocked' is excluded
 * at the type level (a blocker is a risk, never an item status). */
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

/** The display ItemStatus of a stored item: the enum verbatim, with a
 * type-appropriate default for legacy rows missing a status. */
export function deriveItemStatus(item: {
  workflowStatus: ItemWorkflowStatus | null;
  type: ItemType;
}): ItemStatus {
  if (item.workflowStatus) return workflowToItemStatus(item.workflowStatus);
  return item.type === "next" ? "planned" : IN_PROGRESS_STATUS;
}

/**
 * record-status-derived-from-risk: apply the covering-risk BLOCKED overlay to a
 * base progress status — the SAME derivation the lead card uses. Only an
 * in-progress item is eligible for the derived alarm. `at-risk` amber stays
 * deferred to a later head-parity pass, so ONLY the blocked overlay is applied
 * on the head surfaces.
 */
export function applyBlockedRiskOverlay(
  base: ItemStatus,
  parent: { projectId: string; stageIds?: readonly string[] | null },
  alarmRisks: readonly AlarmRisk[],
): ItemStatus {
  const covered = deriveItemAlarmFromRisks(
    {
      productId: parent.projectId,
      stageIds: parent.stageIds ?? undefined,
      status: base,
    },
    alarmRisks,
  );
  return covered === "blocked" ? "blocked" : base;
}

/**
 * The head-report item badge status: the stored-field progress status with the
 * covering-risk blocked overlay applied (see {@link applyBlockedRiskOverlay}).
 */
export function deriveHeadItemStatus(
  item: {
    workflowStatus: ItemWorkflowStatus | null;
    type: ItemType;
    projectId: string;
    stageIds?: readonly string[] | null;
  },
  alarmRisks: readonly AlarmRisk[],
): ItemStatus {
  return applyBlockedRiskOverlay(deriveItemStatus(item), item, alarmRisks);
}
