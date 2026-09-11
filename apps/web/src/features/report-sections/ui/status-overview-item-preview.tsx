import { useEffect, useRef, useState } from "react";

import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
import { OutcomeAudit } from "./status-overview-outcome-audit";

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

function progressLabel(item: StatusOverviewItem): string {
  if (item.source === "current" && item.workflowStatus === "planned")
    return "Not started";
  return PROGRESS_LABELS[item.workflowStatus];
}

const ACTION_CLASS =
  "inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-sm)] px-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";
const QUIET_ACTION_CLASS =
  "inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-sm)] px-2 text-xs text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

function PreviewText({
  item,
  expanded,
  onEditItem,
  onQuickEditText,
  onResolvePlan,
  onRestorePlan,
}: {
  readonly item: StatusOverviewItem;
  readonly expanded: boolean;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onQuickEditText?:
    ((item: StatusOverviewItem, text: string) => void) | undefined;
  readonly onResolvePlan?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onRestorePlan?: ((item: StatusOverviewItem) => void) | undefined;
}) {
  const target = item.editTarget;
  const targetIdentity =
    item.stableId ??
    (target ? `${target.source}:${target.recordId}` : item.key);
  const canCollapse = item.text.length > LONG_UPDATE_LENGTH;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    setEditing(false);
    if (onQuickEditText && next.length > 0 && next !== item.text) {
      onQuickEditText(item, next);
    } else {
      setDraft(item.text);
    }
  };

  if (editing && onQuickEditText) {
    return (
      <form
        className="min-w-0"
        onSubmit={(event) => {
          event.preventDefault();
          commit();
        }}
      >
        <textarea
          ref={textareaRef}
          rows={2}
          value={draft}
          aria-label={`Edit update text: ${item.text}`}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(item.text);
              setEditing(false);
            }
          }}
          className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-2 py-1 text-sm leading-5 text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        />
        <div className="mt-1 flex items-center gap-1">
          <button type="submit" className={ACTION_CLASS}>
            Save
          </button>
          <button
            type="button"
            className={QUIET_ACTION_CLASS}
            onClick={() => {
              setDraft(item.text);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const textClassName = `${expanded || !canCollapse ? "" : "line-clamp-2"} min-h-10 break-words text-sm leading-5 [overflow-wrap:anywhere]`;
  const hasActions =
    Boolean(onEditItem && target) || item.canResolve || item.canRestore;
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
      {onQuickEditText ? (
        <button
          type="button"
          aria-label={`Quick edit ${item.text}`}
          onClick={() => {
            setDraft(item.text);
            setEditing(true);
          }}
          className={`${textClassName} -mx-1 rounded-[var(--radius-sm)] px-1 text-left hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]`}
        >
          {item.text}
        </button>
      ) : (
        <p className={textClassName}>{item.text}</p>
      )}
      {hasActions ? (
        <div className="flex flex-wrap items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover/item:opacity-100 group-focus-within/item:opacity-100">
          <OutcomeActions
            item={item}
            onResolvePlan={onResolvePlan}
            onRestorePlan={onRestorePlan}
          />
          {onEditItem && target ? (
            <button
              type="button"
              aria-label={`Edit ${item.text}`}
              data-overview-focus={`edit:${item.source}:${item.stableId ?? item.key}`}
              data-overview-focus-fallback={`edit:${target.source}:${targetIdentity}`}
              onClick={() => onEditItem(target)}
              className={ACTION_CLASS}
            >
              Edit
            </button>
          ) : null}
        </div>
      ) : null}
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
  onQuickEditText,
  onResolvePlan,
  onRestorePlan,
}: {
  readonly item: StatusOverviewItem;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onQuickEditText?:
    ((item: StatusOverviewItem, text: string) => void) | undefined;
  readonly onResolvePlan?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onRestorePlan?: ((item: StatusOverviewItem) => void) | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div data-overview-item-preview className="group/item min-w-0 space-y-1.5">
      <PreviewText
        item={item}
        expanded={expanded}
        onEditItem={onEditItem}
        onQuickEditText={onQuickEditText}
        onResolvePlan={onResolvePlan}
        onRestorePlan={onRestorePlan}
      />
      <PreviewMetadata item={item} />
      <OutcomeAudit item={item} />
      <TextDisclosure
        item={item}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      />
    </div>
  );
}
