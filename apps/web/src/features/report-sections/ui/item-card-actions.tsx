"use client";

import { LockBadge } from "../../../shared/ui/report-shell/lock-badge";
import type { KanbanItem } from "../model/types";

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path d="M8 5v14M16 5v14" />
    </svg>
  );
}

const NEUTRAL_ACTION_CLASS =
  "flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] items-center justify-center rounded border border-[var(--color-muted)] bg-white text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]";

interface ItemCardActionsProps {
  readonly item: KanbanItem;
  readonly locked: boolean;
  readonly isEditing: boolean;
  // Resolve-not-delete (ADR 0015): published-lineage records withhold Delete.
  readonly publishedLocked?: boolean;
  readonly onEdit?: (id: string) => void;
  readonly onDelete?: (id: string) => void;
  // Move handlers flip status/type in place so durable identity (comment anchors) survives.
  readonly onMarkComplete?: (id: string) => void;
  readonly onMoveToNextWeek?: (id: string) => void;
  readonly onMoveToCurrentWeek?: (id: string) => void;
  readonly onPause?: (id: string) => void;
}

export function ItemCardActions({
  item,
  locked,
  isEditing,
  publishedLocked = false,
  onEdit,
  onDelete,
  onMarkComplete,
  onMoveToNextWeek,
  onMoveToCurrentWeek,
  onPause,
}: ItemCardActionsProps) {
  if (locked || isEditing) {
    return item.foreign === true ? (
      <div className="flex shrink-0 gap-1">
        <LockBadge authorName={item.author} variant="slim" />
      </div>
    ) : null;
  }
  return (
    <div className="flex shrink-0 gap-1">
      {onMoveToCurrentWeek && item.status !== "completed" && (
        <button
          type="button"
          className={NEUTRAL_ACTION_CLASS}
          onClick={() => onMoveToCurrentWeek(item.id)}
          aria-label="Move to current week"
          title="Move to current week"
        >
          <ArrowLeftIcon />
        </button>
      )}
      {onPause && item.status === "in-progress" && (
        <button
          type="button"
          className={NEUTRAL_ACTION_CLASS}
          onClick={() => onPause(item.id)}
          aria-label="Pause"
          title="Pause (a reason is required)"
        >
          <PauseIcon />
        </button>
      )}
      {onMarkComplete && item.status !== "completed" && (
        <button
          type="button"
          className={`${NEUTRAL_ACTION_CLASS} hover:text-[var(--color-primary)]`}
          onClick={() => onMarkComplete(item.id)}
          aria-label="Mark complete"
          title="Mark complete"
        >
          <CheckIcon />
        </button>
      )}
      {onMoveToNextWeek && item.status !== "completed" && (
        <button
          type="button"
          className={NEUTRAL_ACTION_CLASS}
          onClick={() => onMoveToNextWeek(item.id)}
          aria-label="Move to next week"
          title="Move to next week"
        >
          <ArrowRightIcon />
        </button>
      )}
      {onEdit && (
        <button
          type="button"
          className={NEUTRAL_ACTION_CLASS}
          onClick={() => onEdit(item.id)}
          aria-label="Edit"
        >
          <EditIcon />
        </button>
      )}
      {onDelete && !publishedLocked && (
        <button
          type="button"
          className="flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] items-center justify-center rounded border border-[var(--color-muted)] bg-white text-[var(--color-muted-foreground)] transition-colors hover:border-[color-mix(in_srgb,var(--color-destructive)_20%,transparent)] hover:bg-[var(--color-status-blocked-bg)] hover:text-[var(--color-destructive)]"
          onClick={() => onDelete(item.id)}
          aria-label="Delete"
        >
          <DeleteIcon />
        </button>
      )}
    </div>
  );
}

export function PublishedRecordMarker() {
  return (
    <span
      className="inline-flex w-fit shrink-0 items-center rounded-[var(--radius-pill)] border border-[var(--color-primary)]/40 bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]"
      title="In the published report — mark it done or carry it forward; it cannot be deleted."
    >
      In published report
    </span>
  );
}
