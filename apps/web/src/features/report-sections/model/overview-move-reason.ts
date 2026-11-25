import type { StatusOverviewItem } from "./status-overview";
const SAVED_STEP_MOVE_REASON =
  "Its next step is already planned in Next week. Edit the next step instead";
export function overviewMoveReason(
  item: StatusOverviewItem,
  occupied: boolean,
): string | undefined {
  if (item.editTarget?.focusNextStep) return "A next step stays with its item.";
  if (item.nextStepText?.trim()) return SAVED_STEP_MOVE_REASON;
  if (occupied)
    return item.source === "next"
      ? "This week already has this item."
      : "Next week already has this item.";
  if (!item.stableId) return "Not saved yet. Retry or discard the change first";
  if (item.resolution) return "Closed as Won’t do. Restore it first";
  if (!item.editTarget) return "Read-only report";
  if (item.workflowStatus === "done") return "Done items stay in This week";
  return undefined;
}
