import { useRef, useState } from "react";

import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
import { statusOverviewItemActions } from "../model/status-overview-items";
import { OVERVIEW_ITEM_ACTION_CLASS } from "./status-overview-quick-edit-form";

interface ActionProps {
  readonly item: StatusOverviewItem;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onPlanItem?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onMoveItem?:
    | ((
        item: StatusOverviewItem,
        target: "current" | "next",
        focusKey?: string,
      ) => void)
    | undefined;
  readonly onConfirmItem?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onResolvePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onRestorePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
}

const PRIMARY_ACTION_CLASS =
  "inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 text-xs font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-starbucks-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]";

function ProgressAction({ item, onEditItem }: ActionProps) {
  if (statusOverviewItemActions(item).primary !== "progress") return null;
  const target = item.editTarget;
  if (target === null || onEditItem === undefined) return null;
  const carried = item.needsConfirmation === true;
  const identity = item.stableId ?? item.key;
  // Carried items keep the confirm anchor: the submit-readiness summary
  // deep-links to `confirm:current:<stableId>`, and saving the editor clears
  // carriedOver through the existing confirmation patch. Other items reuse the
  // `edit:` focus key so readiness links land on a top-level control.
  const focusKey = `${carried ? "confirm" : "edit"}:${item.source}:${identity}`;
  return (
    <button
      id={carried ? focusKey : undefined}
      type="button"
      aria-label={`Update progress for ${item.text}`}
      data-overview-focus={focusKey}
      onClick={() => onEditItem(target)}
      className={PRIMARY_ACTION_CLASS}
    >
      Update progress
    </button>
  );
}

function MenuItem({
  label,
  ariaLabel,
  focusKey,
  fallbackKey,
  onActivate,
}: {
  readonly label: string;
  readonly ariaLabel: string;
  readonly focusKey: string;
  readonly fallbackKey?: string;
  readonly onActivate: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-overview-focus={focusKey}
      data-overview-focus-fallback={fallbackKey}
      onClick={onActivate}
      className={OVERVIEW_ITEM_ACTION_CLASS}
    >
      {label}
    </button>
  );
}

function EditMenuItem({
  item,
  target,
  onEdit,
  onDone,
}: {
  readonly item: StatusOverviewItem;
  readonly target: StatusOverviewEditTarget;
  readonly onEdit: (target: StatusOverviewEditTarget) => void;
  readonly onDone: () => void;
}) {
  const identity = item.stableId ?? item.key;
  return (
    <MenuItem
      label="Edit details"
      ariaLabel={`Edit details: ${item.text}`}
      focusKey={`edit:${item.source}:${identity}`}
      fallbackKey={`edit:${target.source}:${
        item.stableId ?? `${target.source}:${target.recordId}`
      }`}
      onActivate={() => {
        onDone();
        onEdit(target);
      }}
    />
  );
}

function StatusMenuItem({
  item,
  onResolve,
  onDone,
}: {
  readonly item: StatusOverviewItem;
  readonly onResolve: NonNullable<ActionProps["onResolvePlan"]>;
  readonly onDone: () => void;
}) {
  const focusKey = `resolve:${item.source}:${item.stableId ?? item.key}`;
  return (
    <MenuItem
      label="Update status"
      ariaLabel={`Update status: ${item.text}`}
      focusKey={focusKey}
      onActivate={() => {
        onDone();
        onResolve(item, focusKey);
      }}
    />
  );
}

function MoveMenuItem({
  item,
  onMove,
  onDone,
}: {
  readonly item: StatusOverviewItem;
  readonly onMove: NonNullable<ActionProps["onMoveItem"]>;
  readonly onDone: () => void;
}) {
  const nextWeek = item.source === "current";
  const focusKey = `move:${item.source}:${item.stableId ?? item.key}`;
  return (
    <MenuItem
      label={nextWeek ? "Move to next week" : "Move to this week"}
      ariaLabel={`Move ${item.text} to ${nextWeek ? "next week" : "this week"}`}
      focusKey={focusKey}
      onActivate={() => {
        onDone();
        onMove(item, nextWeek ? "next" : "current", focusKey);
      }}
    />
  );
}

function MoreActions({
  item,
  onEditItem,
  onMoveItem,
  onResolvePlan,
}: ActionProps) {
  const [open, setOpen] = useState(false);
  const summaryRef = useRef<HTMLElement>(null);
  const secondary = statusOverviewItemActions(item).secondary;
  const edit = secondary.includes("edit") ? onEditItem : undefined;
  const move = secondary.includes("move") ? onMoveItem : undefined;
  // The terminal outcome path stays available for active editable items, but
  // never on Previous rows or an unconfirmed carry — the canonical progress
  // editor clears that first.
  const status =
    item.source !== "previous" &&
    item.needsConfirmation !== true &&
    item.canResolve
      ? onResolvePlan
      : undefined;
  const target = item.editTarget;
  if ((!edit && !move && !status) || target === null) return null;
  const close = () => setOpen(false);
  return (
    <details
      open={open}
      className="min-w-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close();
          summaryRef.current?.focus();
        }
      }}
    >
      <summary
        ref={summaryRef}
        aria-label={`More actions for ${item.text}`}
        onClick={(event) => {
          event.preventDefault();
          setOpen(!open);
        }}
        className={`${OVERVIEW_ITEM_ACTION_CLASS} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
      >
        More actions
      </summary>
      <div className="flex flex-wrap items-center gap-1 pt-1">
        {edit ? (
          <EditMenuItem
            item={item}
            target={target}
            onEdit={edit}
            onDone={close}
          />
        ) : null}
        {status ? (
          <StatusMenuItem item={item} onResolve={status} onDone={close} />
        ) : null}
        {move ? (
          <MoveMenuItem item={item} onMove={move} onDone={close} />
        ) : null}
      </div>
    </details>
  );
}

function PlanAction({ item, onPlanItem }: ActionProps) {
  if (
    !onPlanItem ||
    !statusOverviewItemActions(item).recovery.includes("replan")
  )
    return null;
  return (
    <button
      type="button"
      data-overview-focus={`plan:${item.source}:${item.stableId ?? item.key}`}
      onClick={() => onPlanItem(item)}
      className={OVERVIEW_ITEM_ACTION_CLASS}
    >
      Plan this work
    </button>
  );
}

function RestoreAction({ item, onRestorePlan }: ActionProps) {
  if (
    !onRestorePlan ||
    !statusOverviewItemActions(item).recovery.includes("restore")
  )
    return null;
  const focusKey = `restore:${item.source}:${item.stableId ?? item.key}`;
  return (
    <button
      type="button"
      aria-label={`Restore ${item.text}`}
      data-overview-focus={focusKey}
      onClick={() => onRestorePlan(item, focusKey)}
      className={OVERVIEW_ITEM_ACTION_CLASS}
    >
      Restore
    </button>
  );
}

function hasActions(props: ActionProps): boolean {
  const { item } = props;
  const actions = statusOverviewItemActions(item);
  const primary = item.editTarget !== null ? props.onEditItem : undefined;
  const resolvable =
    item.source !== "previous" &&
    item.needsConfirmation !== true &&
    item.canResolve &&
    props.onResolvePlan !== undefined;
  return (
    (actions.primary === "progress" && primary !== undefined) ||
    (actions.secondary.includes("edit") && props.onEditItem !== undefined) ||
    (actions.secondary.includes("move") && props.onMoveItem !== undefined) ||
    resolvable ||
    (actions.recovery.includes("replan") && props.onPlanItem !== undefined) ||
    (actions.recovery.includes("restore") && props.onRestorePlan !== undefined)
  );
}

export function PreviewActions(props: ActionProps) {
  if (!hasActions(props)) return null;
  return (
    <div
      data-overview-item-actions
      className="mt-2 flex min-h-[var(--touch-target-min)] flex-wrap items-center gap-1 border-t border-[var(--color-border-subtle)] pt-2 md:mt-auto"
    >
      <ProgressAction {...props} />
      <MoreActions {...props} />
      <PlanAction {...props} />
      <RestoreAction {...props} />
    </div>
  );
}
