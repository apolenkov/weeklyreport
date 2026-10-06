import { NOT_STARTED_LABEL, STATUS_BADGE } from "../model/item-card-style";
import { stageShortLabel } from "../model/stage-tags";
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

const BADGE_CLASS =
  "inline-flex max-w-full items-center truncate rounded-[var(--radius-sm)] bg-[var(--color-muted)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]";

// A short badge: the first stage plus a count; the full names stay in the
// name and tooltip so the badge never carries the whole SDLC list.
function stageBadgeText(stageNames: readonly string[]): string {
  const [first = "", ...rest] = stageNames;
  const short = stageShortLabel(first);
  return rest.length > 0 ? `${short} +${String(rest.length)}` : short;
}

/** Stage badge at rest; the unplanned meaning lives in the status icon name. */
export function ItemBadges({ item }: { readonly item: StatusOverviewItem }) {
  if (item.stageNames.length === 0) return null;
  const stages = item.stageNames.join(", ");
  return (
    <span
      role="img"
      title={stages}
      aria-label={`Stages: ${stages}`}
      className={BADGE_CLASS}
    >
      {stageBadgeText(item.stageNames)}
    </span>
  );
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
