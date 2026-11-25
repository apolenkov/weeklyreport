import { NOT_STARTED_LABEL, STATUS_BADGE } from "../model/item-card-style";
import type { StatusOverviewItem } from "../model/status-overview";

const PROGRESS_LABELS: Readonly<
  Record<StatusOverviewItem["workflowStatus"], string>
> = {
  planned: STATUS_BADGE.planned.label,
  in_progress: STATUS_BADGE["in-progress"].label,
  paused: STATUS_BADGE.paused.label,
  postponed: STATUS_BADGE.postponed.label,
  done: STATUS_BADGE.completed.label,
};

/** Status text for the accessible name, including the carried states. */
export function statusOverviewProgressLabel(item: StatusOverviewItem): string {
  if (item.resolution) return "Won't do";
  if (item.needsConfirmation === true) {
    if (item.workflowStatus === "planned")
      return "Planned · not updated this week";
    if (item.workflowStatus === "in_progress")
      return "Continued · not updated this week";
  }
  if (item.source === "current" && item.workflowStatus === "planned")
    return NOT_STARTED_LABEL;
  return PROGRESS_LABELS[item.workflowStatus];
}

/** The cancellation reason stays visible on a resolved (Won't do) item. */
export function ResolutionNote({
  item,
}: {
  readonly item: StatusOverviewItem;
}) {
  if (!item.resolution) return null;
  return (
    <p className="break-words text-xs text-[var(--color-muted-foreground)]">
      Won&apos;t do · {item.resolution.reason}
    </p>
  );
}
