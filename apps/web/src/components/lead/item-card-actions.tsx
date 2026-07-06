"use client";

import { LockBadge } from "../../shared/ui/report-shell/lock-badge";
import type { KanbanItem } from "./mock-data";

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
  /**
   * Resolve-not-delete (ADR 0015): the record's lineage appeared in a
   * published report — Delete is withheld (the server rejects the drop
   * anyway); the card shows the "In published report" marker instead.
   */
  readonly publishedLocked?: boolean;
  readonly onEdit?: (id: string) => void;
  readonly onDelete?: (id: string) => void;
  /** Move action: flips the item to done IN PLACE (same durable identity). */
  readonly onMarkComplete?: (id: string) => void;
  /** Move action: flips `type` to next IN PLACE (same durable identity). */
  readonly onMoveToNextWeek?: (id: string) => void;
  /** Move action: flips `type` back to current IN PLACE (same durable identity). */
  readonly onMoveToCurrentWeek?: (id: string) => void;
  /**
   * require-paused-item-reason: open the pause-reason prompt for this item.
   * Passed only where pausing applies (current-week, in-progress rows).
   */
  readonly onPause?: (id: string) => void;
}

/**
 * The item card's right-side action cluster: the in-place move actions
 * ("mark complete" / "move to next week" — they mutate the existing draft
 * row, never clone, so C1 comment anchors survive), then edit, then delete.
 * Delete is withheld for a published-lineage record.
 */
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
      <button
        type="button"
        className={NEUTRAL_ACTION_CLASS}
        onClick={() => onEdit?.(item.id)}
        aria-label="Edit"
      >
        <EditIcon />
      </button>
      {!publishedLocked && (
        <button
          type="button"
          className="flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] items-center justify-center rounded border border-[var(--color-muted)] bg-white text-[var(--color-muted-foreground)] transition-colors hover:border-[color-mix(in_srgb,var(--color-destructive)_20%,transparent)] hover:bg-[var(--color-status-blocked-bg)] hover:text-[var(--color-destructive)]"
          onClick={() => onDelete?.(item.id)}
          aria-label="Delete"
        >
          <DeleteIcon />
        </button>
      )}
    </div>
  );
}

/**
 * The visible resolve-not-delete marker: this record is part of the published
 * report, so it can be resolved (marked done) or carried forward, never
 * deleted.
 */
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
