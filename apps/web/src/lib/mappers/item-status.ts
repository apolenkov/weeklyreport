/**
 * Item-status mapper: bridges the API ItemWorkflowStatus enum
 * (done/in_progress/blocked) with the UI ItemStatus enum
 * (completed/in-progress/blocked/planned).
 *
 * 'planned' is a presentation-only state with no DB enum value:
 * next-week in-progress rows use completed=null for planned and
 * completed=false for explicit in-progress.
 */

import { type AlarmRisk, deriveItemAlarmFromRisks } from "../item-alarm";

const IN_PROGRESS_STATUS = "in-progress";

export type ItemWorkflowStatus = "done" | "in_progress" | "blocked";
export type ItemType = "current" | "next";
export type ItemStatus = "in-progress" | "completed" | "blocked" | "planned";

/**
 * Converts a stored ItemWorkflowStatus to its presentation ItemStatus.
 * Note: 'planned' is never produced by this function -- it is only
 * derivable from {@link deriveItemStatus} for next-week rows.
 */
export function workflowToItemStatus(
  ws: ItemWorkflowStatus,
): Exclude<ItemStatus, "planned"> {
  switch (ws) {
    case "done":
      return "completed";
    case "in_progress":
      return IN_PROGRESS_STATUS;
    case "blocked":
      return "blocked";
  }
}

/**
 * Inverse mapping for non-computed presentation states.
 * 'planned' has no API equivalent and is excluded at the type level.
 */
export function itemStatusToWorkflow(
  status: Exclude<ItemStatus, "planned">,
): ItemWorkflowStatus {
  switch (status) {
    case "completed":
      return "done";
    case IN_PROGRESS_STATUS:
      return "in_progress";
    case "blocked":
      return "blocked";
  }
}

/**
 * Derives the display ItemStatus from an item's stored fields.
 *
 * Rules:
 * - type === 'next' + workflowStatus='in_progress' + completed=false
 *   -> 'in-progress'
 * - type === 'next' + workflowStatus='in_progress' + completed null/undefined
 *   -> 'planned'
 * - explicit done/blocked next-week status is preserved
 * - explicit workflowStatus on a current-week item wins
 * - default for current-week with no workflowStatus -> 'in-progress'
 */
export function deriveItemStatus(item: {
  workflowStatus: ItemWorkflowStatus | null;
  type: ItemType;
  completed?: boolean | null;
}): ItemStatus {
  if (item.type === "next") {
    if (item.workflowStatus === "done") return "completed";
    if (item.workflowStatus === "blocked") return "blocked";
    if (item.workflowStatus === "in_progress" && item.completed === false) {
      return IN_PROGRESS_STATUS;
    }
    return "planned";
  }
  if (item.workflowStatus) {
    return workflowToItemStatus(item.workflowStatus);
  }
  return IN_PROGRESS_STATUS;
}

/**
 * record-status-derived-from-risk: apply the covering-risk BLOCKED overlay to a
 * base progress status — the SAME derivation the lead card uses. A `blocked`
 * base is a legacy stored value; it shows as in-progress unless a covering
 * blocked-severity risk exists. `at-risk` amber stays deferred to a later
 * head-parity pass, so ONLY the blocked overlay is applied on the head surfaces.
 */
export function applyBlockedRiskOverlay(
  base: ItemStatus,
  parent: { projectId: string; stageIds?: readonly string[] | null },
  alarmRisks: readonly AlarmRisk[],
): ItemStatus {
  // Coerce a stored blocked to in-progress before the overlay so the
  // derivation's in-progress eligibility gate fires.
  const eligible = base === "blocked" ? IN_PROGRESS_STATUS : base;
  const covered = deriveItemAlarmFromRisks(
    {
      productId: parent.projectId,
      stageIds: parent.stageIds ?? undefined,
      status: eligible,
    },
    alarmRisks,
  );
  return covered === "blocked" ? "blocked" : eligible;
}

/**
 * The head-report item badge status: the stored-field progress status with the
 * covering-risk blocked overlay applied (see {@link applyBlockedRiskOverlay}).
 */
export function deriveHeadItemStatus(
  item: {
    workflowStatus: ItemWorkflowStatus | null;
    type: ItemType;
    completed?: boolean | null;
    projectId: string;
    stageIds?: readonly string[] | null;
  },
  alarmRisks: readonly AlarmRisk[],
): ItemStatus {
  return applyBlockedRiskOverlay(deriveItemStatus(item), item, alarmRisks);
}
