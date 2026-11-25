import type { StatusOverviewItem } from "./status-overview";
export const SAVED_STEP_MOVE_REASON =
  "Its next step is already planned in Next week. Edit the next step instead";
export function overviewMoveReason(
  item: StatusOverviewItem,
  occupied: boolean,
): string | undefined {
  if (item.editTarget?.focusNextStep) return "A next step stays with its item.";
  if (item.nextStepText?.trim()) return SAVED_STEP_MOVE_REASON;
  if (occupied)
    return item.source === "next"
      ? "Already in This week"
      : "Already planned in Next week";
  if (!item.stableId) return "Save this entry before moving it.";
  if (!item.editTarget || item.resolution) return "This record is read-only.";
  if (item.workflowStatus === "done") return "Completed work cannot be moved.";
  return undefined;
}
