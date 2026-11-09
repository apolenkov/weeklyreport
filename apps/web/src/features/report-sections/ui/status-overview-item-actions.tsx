import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
import type {
  SetStagesHandler,
  SetStatusHandler,
  VerdictHandler,
} from "./status-overview-item-handlers";

export interface ActionProps {
  readonly item: StatusOverviewItem;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  /** Commits the inline in-place text edit of one editable item. */
  readonly onEditItemText?:
    ((item: StatusOverviewItem, text: string) => void) | undefined;
  readonly onPlanItem?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onMoveItem?:
    | ((
        item: StatusOverviewItem,
        target: "current" | "next",
        focusKey?: string,
      ) => void)
    | undefined;
  readonly onConfirmItem?: ((item: StatusOverviewItem) => void) | undefined;
  readonly onSetStatus?: SetStatusHandler | undefined;
  readonly onSetStages?: SetStagesHandler | undefined;
  readonly ownedStages?: readonly string[] | undefined;
  readonly onResolvePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onRestorePlan?:
    ((item: StatusOverviewItem, focusKey?: string) => void) | undefined;
  readonly onVerdict?: VerdictHandler | undefined;
}

// A solid primary outline: the translucent ring token is too faint on the
// cream card to read as focus.
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)]";
const HOVER_FILL = "hover:bg-[var(--color-muted)]";
export const ICON_BUTTON_CLASS = `inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-primary)] ${HOVER_FILL} ${FOCUS_RING}`;
/** A rail control that pairs its icon with a visible text label. */
export const LABELLED_BUTTON_CLASS = `inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-sm)] px-1.5 text-xs font-semibold text-[var(--color-foreground)] ${HOVER_FILL} ${FOCUS_RING}`;
// Card row actions are compact on hoverable pointers, inside the column the
// card reserves, and take the full touch target where a finger has no hover.
export const ROW_BUTTON_CLASS = `inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-primary)] ${HOVER_FILL} [@media(hover:none)]:min-h-[var(--touch-target-min)] [@media(hover:none)]:min-w-[var(--touch-target-min)] ${FOCUS_RING}`;
export const MENU_ITEM_CLASS = "min-h-[var(--touch-target-min)] cursor-pointer";
export function identityOf(item: StatusOverviewItem): string {
  return item.stableId ?? item.key;
}

/** Shared focus key of the week-move icon and the Alt+Arrow keyboard move. */
export function weekMoveFocusKey(item: StatusOverviewItem): string {
  return `move:${item.source}:${identityOf(item)}`;
}

// The terminal outcome path stays available for active editable items, but
// never on Previous rows, an unconfirmed carry (choosing a status clears that
// first), or a derived Next projection — that row is the same Current
// record's commitment, and its terminal status belongs to the Current
// occurrence.
export function canResolveFromStatus(item: StatusOverviewItem): boolean {
  const target = item.editTarget;
  return (
    target !== null &&
    item.source !== "previous" &&
    item.needsConfirmation !== true &&
    target.focusNextStep !== true &&
    item.canResolve
  );
}
