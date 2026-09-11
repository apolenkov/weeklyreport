import { useState } from "react";

import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";

const PROGRESS_LABELS: Readonly<
  Record<StatusOverviewItem["workflowStatus"], string>
> = {
  planned: "Planned",
  in_progress: "In progress",
  paused: "Paused",
  postponed: "Postponed",
  done: "Done",
};
const LONG_UPDATE_LENGTH = 120;
const OUTCOME_LABELS = {
  done: "Completed",
  continue: "Continued",
  plan_next: "Planned next step",
  restore: "Restored plan",
  wont_do: "Marked Won't do",
} as const;

function progressLabel(item: StatusOverviewItem): string {
  if (item.source === "current" && item.workflowStatus === "planned")
    return "Not started";
  return PROGRESS_LABELS[item.workflowStatus];
}

function auditTimestamp(occurredAt: string): string {
  return occurredAt.replace("T", " ").replace(/:\d{2}(?:\.\d+)?Z$/, " UTC");
}

function OutcomeAudit({ item }: { readonly item: StatusOverviewItem }) {
  const resolution = item.resolution ?? null;
  const events = item.outcomeHistory ?? [];
  if (resolution === null && events.length === 0) return null;
  return (
    <details className="text-xs text-[var(--color-muted-foreground)]">
      <summary className="flex min-h-[var(--touch-target-min)] cursor-pointer items-center rounded-[var(--radius-sm)] px-1 font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
        Outcome history
      </summary>
      <ul className="space-y-1 px-1 pb-1">
        {events.length > 0 ? (
          events.map((event) => (
            <li key={event.id} className="break-words">
              {OUTCOME_LABELS[event.outcome]} by {event.actorName} ·{" "}
              {auditTimestamp(event.occurredAt)}
              {event.reason ? ` · ${event.reason}` : ""}
            </li>
          ))
        ) : resolution ? (
          <li className="break-words">
            Marked Won&apos;t do by {resolution.actorName} ·{" "}
            {auditTimestamp(resolution.occurredAt)}
          </li>
        ) : null}
      </ul>
    </details>
  );
}

function PreviewText({
  item,
  expanded,
  onEditItem,
}: {
  readonly item: StatusOverviewItem;
  readonly expanded: boolean;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
}) {
  const target = item.editTarget;
  const targetIdentity =
    item.stableId ??
    (target ? `${target.source}:${target.recordId}` : item.key);
  const canCollapse = item.text.length > LONG_UPDATE_LENGTH;
  const textClassName = `${expanded || !canCollapse ? "" : "line-clamp-2"} min-h-10 break-words text-sm leading-5 [overflow-wrap:anywhere]`;
  if (!target || !onEditItem)
    return <p className={textClassName}>{item.text}</p>;
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
      <p className={textClassName}>{item.text}</p>
      <button
        type="button"
        aria-label={`Edit ${item.text}`}
        data-overview-focus={`edit:${item.source}:${item.stableId ?? item.key}`}
        data-overview-focus-fallback={`edit:${target.source}:${targetIdentity}`}
        onClick={() => onEditItem(target)}
        className="inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-sm)] px-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        Edit
      </button>
    </div>
  );
}

function PreviewMetadata({ item }: { readonly item: StatusOverviewItem }) {
  const resolution = item.resolution ?? null;
  return (
    <>
      <p className="break-words text-xs text-[var(--color-muted-foreground)]">
        {resolution ? `Won't do · ${resolution.reason}` : progressLabel(item)}
        {item.stageNames.length > 0 ? ` · ${item.stageNames.join(", ")}` : ""}
        {item.tag ? ` · ${item.tag}` : ""}
      </p>
      {item.pausedReason ? (
        <p className="break-words text-xs text-[var(--color-muted-foreground)]">
          Paused: {item.pausedReason}
        </p>
      ) : null}
      {item.continuity === "unplanned" ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Not in prior plan
        </p>
      ) : null}
    </>
  );
}

function OutcomeActions({
  item,
  onResolvePlan,
  onRestorePlan,
}: {
  readonly item: StatusOverviewItem;
  readonly onResolvePlan?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onRestorePlan?: ((item: StatusOverviewItem) => void) | undefined;
}) {
  const focusIdentity = item.stableId ?? item.key;
  return (
    <>
      {item.canResolve && onResolvePlan ? (
        <button
          type="button"
          aria-label={`Resolve plan: ${item.text}`}
          data-overview-focus={`resolve:${item.source}:${focusIdentity}`}
          onClick={() => onResolvePlan(item)}
          className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          Resolve plan
        </button>
      ) : null}
      {item.canRestore && onRestorePlan ? (
        <button
          type="button"
          aria-label={`Restore plan: ${item.text}`}
          data-overview-focus={`restore:${item.source}:${focusIdentity}`}
          onClick={() => onRestorePlan(item)}
          className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          Restore plan
        </button>
      ) : null}
    </>
  );
}

function TextDisclosure({
  item,
  expanded,
  onToggle,
}: {
  readonly item: StatusOverviewItem;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}) {
  if (item.text.length <= LONG_UPDATE_LENGTH) return null;
  const label = expanded ? "Show less" : "Show full update";
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={`${label}: ${item.text}`}
      onClick={onToggle}
      className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-1 text-xs text-[var(--color-primary)] underline underline-offset-4 hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      {label}
    </button>
  );
}

export function StatusOverviewItemPreview({
  item,
  onEditItem,
  onResolvePlan,
  onRestorePlan,
}: {
  readonly item: StatusOverviewItem;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onResolvePlan?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onRestorePlan?: ((item: StatusOverviewItem) => void) | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div data-overview-item-preview className="min-w-0 space-y-1.5">
      <PreviewText item={item} expanded={expanded} onEditItem={onEditItem} />
      <PreviewMetadata item={item} />
      <OutcomeActions
        item={item}
        onResolvePlan={onResolvePlan}
        onRestorePlan={onRestorePlan}
      />
      <OutcomeAudit item={item} />
      <TextDisclosure
        item={item}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
    </div>
  );
}
