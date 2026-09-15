import type { StatusOverviewItem } from "../model/status-overview";
import { ProgressIcon, StageIcon, TagIcon } from "./status-overview-item-icons";

const PROGRESS_LABELS: Readonly<
  Record<StatusOverviewItem["workflowStatus"], string>
> = {
  planned: "Planned",
  in_progress: "In progress",
  paused: "Paused",
  postponed: "Postponed",
  done: "Done",
};

function progressLabel(item: StatusOverviewItem): string {
  if (item.source === "current" && item.workflowStatus === "planned")
    return "Not started";
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
  const resolution = item.resolution ?? null;
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-muted-foreground)]">
        <MetaFact>
          <ProgressIcon status={item.workflowStatus} />
          <span className="break-words">
            {resolution
              ? `Won't do · ${resolution.reason}`
              : progressLabel(item)}
          </span>
        </MetaFact>
        {item.stageNames.length > 0 ? (
          <MetaFact>
            <StageIcon />
            <span className="break-words">{item.stageNames.join(", ")}</span>
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
