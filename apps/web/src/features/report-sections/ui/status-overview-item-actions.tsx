import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@customreport/ui/components/ui/dropdown-menu";
import { ChevronDown, MoreHorizontal } from "lucide-react";

import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
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

function restoreFocusAfterConfirmation(item: StatusOverviewItem): void {
  queueMicrotask(() => {
    const identity = item.stableId ?? item.key;
    const target = Array.from(
      document.querySelectorAll<HTMLElement>("[data-overview-focus]"),
    ).find(
      (element) =>
        element.dataset.overviewFocus === `edit:${item.source}:${identity}`,
    );
    (
      target ??
      document.querySelector<HTMLElement>("[data-overview-focus-heading]")
    )?.focus();
  });
}

function ConfirmAction({ item, onConfirmItem }: ActionProps) {
  if (!onConfirmItem || item.source !== "current" || !item.needsConfirmation)
    return null;
  const focusKey = `confirm:${item.source}:${item.stableId ?? item.key}`;
  return (
    <button
      id={focusKey}
      type="button"
      aria-label={`Confirm ${item.text} for this week`}
      data-overview-focus={focusKey}
      onClick={() => {
        onConfirmItem(item);
        restoreFocusAfterConfirmation(item);
      }}
      className="inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 text-xs font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-starbucks-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      Confirm for this week
    </button>
  );
}

function EditAction({ item, onEditItem }: ActionProps) {
  const target = item.editTarget;
  if (!onEditItem || !target || target.focusNextStep) return null;
  const targetIdentity = item.stableId ?? `${target.source}:${target.recordId}`;
  return (
    <button
      type="button"
      aria-label={`Edit update: ${item.text}`}
      data-overview-focus={`edit:${item.source}:${item.stableId ?? item.key}`}
      data-overview-focus-fallback={`edit:${target.source}:${targetIdentity}`}
      onClick={() => onEditItem(target)}
      className={OVERVIEW_ITEM_ACTION_CLASS}
    >
      Edit
    </button>
  );
}

function MoveAction({ item, onMoveItem }: ActionProps) {
  const target = item.editTarget;
  if (
    !onMoveItem ||
    !target ||
    item.resolution != null ||
    item.workflowStatus === "done"
  )
    return null;
  const nextWeek = item.source === "current";
  const focusKey = `move:${item.source}:${item.stableId ?? item.key}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Move ${item.text}`}
          data-overview-focus={focusKey}
          className={OVERVIEW_ITEM_ACTION_CLASS}
        >
          Move
          <ChevronDown aria-hidden="true" className="ml-1 h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label={`Move ${item.text}`}>
        <DropdownMenuItem
          data-overview-focus={focusKey}
          className="min-h-[var(--touch-target-min)]"
          onSelect={() =>
            onMoveItem(item, nextWeek ? "next" : "current", focusKey)
          }
        >
          Move to {nextWeek ? "next week" : "this week"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PlanAction({ item, onPlanItem }: ActionProps) {
  if (
    !onPlanItem ||
    item.source !== "previous" ||
    !item.canResolve ||
    item.resolution != null ||
    item.workflowStatus === "done"
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

function SecondaryActions({ item, onResolvePlan, onRestorePlan }: ActionProps) {
  const resolve =
    !item.needsConfirmation && item.canResolve && onResolvePlan !== undefined;
  const restore = item.canRestore && onRestorePlan !== undefined;
  if (!resolve && !restore) return null;
  const kind = restore ? "restore" : "resolve";
  const focusKey = `${kind}:${item.source}:${item.stableId ?? item.key}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More actions for ${item.text}`}
          data-overview-focus={focusKey}
          className={OVERVIEW_ITEM_ACTION_CLASS}
        >
          <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">More actions</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        aria-label={`Actions for ${item.text}`}
      >
        {resolve ? (
          <DropdownMenuItem
            data-overview-focus={focusKey}
            className="min-h-[var(--touch-target-min)]"
            onSelect={() => onResolvePlan(item, focusKey)}
          >
            Update status
          </DropdownMenuItem>
        ) : null}
        {restore ? (
          <DropdownMenuItem
            data-overview-focus={focusKey}
            className="min-h-[var(--touch-target-min)]"
            onSelect={() => onRestorePlan(item, focusKey)}
          >
            Restore
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function hasActions(props: ActionProps): boolean {
  const { item } = props;
  return (
    (props.onEditItem !== undefined &&
      item.editTarget !== null &&
      !item.editTarget.focusNextStep) ||
    (props.onPlanItem !== undefined &&
      item.source === "previous" &&
      item.canResolve &&
      item.resolution == null &&
      item.workflowStatus !== "done") ||
    (props.onMoveItem !== undefined &&
      item.editTarget !== null &&
      item.resolution == null &&
      item.workflowStatus !== "done") ||
    (props.onConfirmItem !== undefined &&
      item.source === "current" &&
      (item.needsConfirmation ?? false)) ||
    item.canResolve ||
    item.canRestore
  );
}

export function PreviewActions(props: ActionProps) {
  if (!hasActions(props)) return null;
  return (
    <div
      data-overview-item-actions
      className="mt-2 flex min-h-[var(--touch-target-min)] flex-wrap items-center gap-1 border-t border-[var(--color-border-subtle)] pt-2 md:mt-auto"
    >
      <ConfirmAction {...props} />
      <EditAction {...props} />
      <PlanAction {...props} />
      <MoveAction {...props} />
      <SecondaryActions {...props} />
    </div>
  );
}
