"use client";

import type { ReactNode } from "react";

import { LockBadge } from "../../../shared/ui/report-shell/lock-badge";
import type { KanbanItem } from "../model/types";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  DeleteIcon,
  EditIcon,
  PauseIcon,
} from "./item-card-action-icons";

// Shared square icon-button shell; the two variants differ only in hover state.
const ACTION_BUTTON_BASE =
  "flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] items-center justify-center rounded border border-[var(--color-muted)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] transition-colors";
const NEUTRAL_ACTION_CLASS = `${ACTION_BUTTON_BASE} hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-foreground)]`;
const DESTRUCTIVE_ACTION_CLASS = `${ACTION_BUTTON_BASE} hover:border-[color-mix(in_srgb,var(--color-destructive)_20%,transparent)] hover:bg-[var(--color-status-blocked-bg)] hover:text-[var(--color-destructive)]`;

function ActionButton({
  className,
  onClick,
  label,
  title,
  children,
}: {
  readonly className: string;
  readonly onClick: () => void;
  readonly label: string;
  readonly title?: string;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={label}
      title={title}
    >
      {children}
    </button>
  );
}

interface ItemCardActionsProps {
  readonly item: KanbanItem;
  readonly locked: boolean;
  readonly isEditing: boolean;
  // Resolve-not-delete (ADR 0015): published-lineage records withhold Delete.
  readonly publishedLocked?: boolean | undefined;
  readonly onEdit?: ((id: string) => void) | undefined;
  readonly onDelete?: ((id: string) => void) | undefined;
  // Move handlers flip status/type in place so durable identity (comment anchors) survives.
  readonly onMarkComplete?: ((id: string) => void) | undefined;
  readonly onMoveToNextWeek?: ((id: string) => void) | undefined;
  readonly onMoveToCurrentWeek?: ((id: string) => void) | undefined;
  readonly onPause?: ((id: string) => void) | undefined;
}

interface StatusActionSpec {
  readonly label: string;
  readonly title: string;
  readonly className: string;
  readonly Icon: () => ReactNode;
}

interface StatusAction extends StatusActionSpec {
  readonly onAct: (id: string) => void;
}

const MOVE_TO_CURRENT_SPEC: StatusActionSpec = {
  label: "Move to current week",
  title: "Move to current week",
  className: NEUTRAL_ACTION_CLASS,
  Icon: ArrowLeftIcon,
};

const PAUSE_SPEC: StatusActionSpec = {
  label: "Pause",
  title: "Pause (a reason is required)",
  className: NEUTRAL_ACTION_CLASS,
  Icon: PauseIcon,
};

const MARK_COMPLETE_SPEC: StatusActionSpec = {
  label: "Mark complete",
  title: "Mark complete",
  className: `${NEUTRAL_ACTION_CLASS} hover:text-[var(--color-primary)]`,
  Icon: CheckIcon,
};

const MOVE_TO_NEXT_SPEC: StatusActionSpec = {
  label: "Move to next week",
  title: "Move to next week",
  className: NEUTRAL_ACTION_CLASS,
  Icon: ArrowRightIcon,
};

function offerAction(
  onAct: ((id: string) => void) | undefined,
  applicable: boolean,
  spec: StatusActionSpec,
): StatusAction | null {
  return onAct && applicable ? { ...spec, onAct } : null;
}

// Left-to-right order is fixed: move back, pause, complete, move forward.
function statusActions(props: ItemCardActionsProps): readonly StatusAction[] {
  const open = props.item.status !== "completed";
  return [
    offerAction(props.onMoveToCurrentWeek, open, MOVE_TO_CURRENT_SPEC),
    offerAction(props.onPause, props.item.status === "in-progress", PAUSE_SPEC),
    offerAction(props.onMarkComplete, open, MARK_COMPLETE_SPEC),
    offerAction(props.onMoveToNextWeek, open, MOVE_TO_NEXT_SPEC),
  ].filter((action) => action !== null);
}

function StatusActions(props: ItemCardActionsProps) {
  return (
    <>
      {statusActions(props).map(({ label, title, className, Icon, onAct }) => (
        <ActionButton
          key={label}
          className={className}
          onClick={() => onAct(props.item.id)}
          label={label}
          title={title}
        >
          <Icon />
        </ActionButton>
      ))}
    </>
  );
}

function EditDeleteActions({
  item,
  publishedLocked = false,
  onEdit,
  onDelete,
}: ItemCardActionsProps) {
  return (
    <>
      {onEdit && (
        <ActionButton
          className={NEUTRAL_ACTION_CLASS}
          onClick={() => onEdit(item.id)}
          label="Edit"
        >
          <EditIcon />
        </ActionButton>
      )}
      {onDelete && !publishedLocked && (
        <ActionButton
          className={DESTRUCTIVE_ACTION_CLASS}
          onClick={() => onDelete(item.id)}
          label="Delete"
        >
          <DeleteIcon />
        </ActionButton>
      )}
    </>
  );
}

export function ItemCardActions(props: ItemCardActionsProps) {
  const { item, locked, isEditing } = props;
  if (locked || isEditing) {
    return item.foreign === true ? (
      <div className="flex shrink-0 gap-1">
        <LockBadge authorName={item.author} variant="slim" />
      </div>
    ) : null;
  }
  return (
    <div className="flex shrink-0 gap-1">
      <StatusActions {...props} />
      <EditDeleteActions {...props} />
    </div>
  );
}

export function PublishedRecordMarker() {
  return (
    <span
      className="inline-flex w-fit shrink-0 items-center rounded-[var(--radius-pill)] border border-[var(--color-primary)]/40 bg-[var(--color-card)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]"
      title="In the published report — mark it done or carry it forward; it cannot be deleted."
    >
      In published report
    </span>
  );
}
