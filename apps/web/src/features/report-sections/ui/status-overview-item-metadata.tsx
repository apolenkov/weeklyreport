import { NOT_STARTED_LABEL, STATUS_BADGE } from "../model/item-card-style";
import type { StatusOverviewItem } from "../model/status-overview";
import { ProgressIcon, StageIcon, TagIcon } from "./status-overview-item-icons";

const PROGRESS_LABELS: Readonly<
  Record<StatusOverviewItem["workflowStatus"], string>
> = {
  planned: STATUS_BADGE.planned.label,
  in_progress: STATUS_BADGE["in-progress"].label,
  paused: STATUS_BADGE.paused.label,
  postponed: STATUS_BADGE.postponed.label,
  done: STATUS_BADGE.completed.label,
};

/** Visible progress text, including the not-yet-confirmed carried states. */
export function statusOverviewProgressLabel(item: StatusOverviewItem): string {
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

function MetaFact({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">{children}</span>
  );
}

/** Secondary facts under an update: progress, stages, tag, pause, continuity. */
export function PreviewMetadata({
  item,
}: {
  readonly item: StatusOverviewItem;
}) {
  const resolution = item.resolution;
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-muted-foreground)]">
        <MetaFact>
          <ProgressIcon status={item.workflowStatus} />
          <span className="break-words">
            {resolution
              ? `Won't do · ${resolution.reason}`
              : statusOverviewProgressLabel(item)}
          </span>
        </MetaFact>
        {item.stageNames.length > 0 ? (
          <MetaFact>
            <StageIcon />
            <span className="break-words">{item.stageNames.join(", ")}</span>
          </MetaFact>
        ) : null}
        {item.continuity === "unplanned" ? (
          <MetaFact>
            <span className="rounded-[var(--radius-sm)] bg-[var(--color-muted)] px-1.5 py-0.5 font-medium">
              Unplanned
            </span>
          </MetaFact>
        ) : null}
        {item.tag ? (
          <MetaFact>
            <TagIcon tag={item.tag} />
            <span className="break-words">{item.tag}</span>
          </MetaFact>
        ) : null}
      </div>
      {item.pausedReason ? (
        <p className="break-words text-xs text-[var(--color-muted-foreground)]">
          Paused: {item.pausedReason}
        </p>
      ) : null}
    </>
  );
}
