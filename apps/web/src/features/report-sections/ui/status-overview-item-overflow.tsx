import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@weeklyreport/ui/components/ui/dropdown-menu";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Ellipsis,
  MessageSquarePlus,
  Pencil,
  Undo2,
} from "lucide-react";

import { shortItemLabel } from "../../../shared/lib/format/short-label";
import {
  focusReviewRecord,
  reviewRecordAnchor,
} from "../../../shared/ui/feedback/review-record-focus";
import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
import { statusOverviewItemActions } from "../model/status-overview-items";
import {
  type ActionProps,
  ICON_BUTTON_CLASS,
  identityOf,
  MENU_ITEM_CLASS,
  weekMoveFocusKey,
} from "./status-overview-item-actions";

// Hidden by opacity and width only, never display:none or visibility, so the
// controls stay in the accessibility tree and the Tab order. They show on
// hover, on focus within the item, while a menu is open, and always where
// hover cannot exist.
const REVEAL_CLASS =
  "flex shrink-0 items-center overflow-hidden transition-[max-width,opacity] max-w-0 opacity-0 group-hover/item:max-w-48 group-hover/item:opacity-100 group-focus-within/item:max-w-48 group-focus-within/item:opacity-100 has-[[data-state=open]]:max-w-48 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:max-w-48 [@media(hover:none)]:opacity-100 motion-reduce:transition-none";

interface OverflowHandlers {
  readonly edit: ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly move: ActionProps["onMoveItem"];
  readonly status: ActionProps["onResolvePlan"];
}

function overflowHandlers({
  item,
  onEditItem,
  onMoveItem,
  onResolvePlan,
}: ActionProps): OverflowHandlers {
  const secondary = statusOverviewItemActions(item).secondary;
  const target = item.editTarget;
  return {
    edit:
      target !== null && secondary.includes("edit") ? onEditItem : undefined,
    move:
      target !== null && secondary.includes("move") ? onMoveItem : undefined,
    // The terminal outcome path stays available for active editable items, but
    // never on Previous rows, an unconfirmed carry (choosing a status in the
    // icon menu clears that first), or a derived Next projection — that row is
    // the same Current record's commitment, and its terminal status belongs to
    // the Current occurrence.
    status:
      target !== null &&
      item.source !== "previous" &&
      item.needsConfirmation !== true &&
      target.focusNextStep !== true &&
      item.canResolve
        ? onResolvePlan
        : undefined,
  };
}

function MoreActions({
  item,
  edit,
  move,
  status,
}: {
  readonly item: StatusOverviewItem;
} & OverflowHandlers) {
  const target = item.editTarget;
  if ((!edit && !move && !status) || target === null) return null;
  const label = shortItemLabel(item.text);
  const identity = identityOf(item);
  const nextWeek = item.source === "current";
  const moveLabel = nextWeek ? "Move to next week" : "Move to this week";
  // Activating an entry returns focus to this trigger once the editor closes.
  const focusKey = `more:${item.source}:${identity}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`More actions for ${label}`}
          title="More actions"
          data-overview-focus={focusKey}
          className={ICON_BUTTON_CLASS}
        >
          <Ellipsis aria-hidden="true" className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {edit ? (
          <DropdownMenuItem
            aria-label={`Edit details: ${label}`}
            data-overview-focus={focusKey}
            onSelect={() => edit(target)}
            className={MENU_ITEM_CLASS}
          >
            Edit details
          </DropdownMenuItem>
        ) : null}
        {status ? (
          <DropdownMenuItem
            aria-label={`Update status: ${label}`}
            onSelect={() => status(item, `resolve:${item.source}:${identity}`)}
            className={MENU_ITEM_CLASS}
          >
            Update status
          </DropdownMenuItem>
        ) : null}
        {move ? (
          <DropdownMenuItem
            aria-label={`${moveLabel}: ${label}`}
            onSelect={() =>
              move(
                item,
                nextWeek ? "next" : "current",
                `more:${item.source}:${identity}`,
              )
            }
            className={MENU_ITEM_CLASS}
          >
            {moveLabel}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PlanAction({ item, onPlanItem }: ActionProps) {
  if (
    !onPlanItem ||
    !statusOverviewItemActions(item).recovery.includes("replan")
  )
    return null;
  const label = `Plan this work: ${shortItemLabel(item.text)}`;
  return (
    <button
      type="button"
      aria-label={label}
      title="Plan this work"
      data-overview-focus={`plan:${item.source}:${identityOf(item)}`}
      onClick={() => onPlanItem(item)}
      className={ICON_BUTTON_CLASS}
    >
      <CalendarPlus aria-hidden="true" className="size-4" />
    </button>
  );
}

function RestoreAction({ item, onRestorePlan }: ActionProps) {
  if (
    !onRestorePlan ||
    !statusOverviewItemActions(item).recovery.includes("restore")
  )
    return null;
  const focusKey = `restore:${item.source}:${identityOf(item)}`;
  return (
    <button
      type="button"
      aria-label={`Restore ${shortItemLabel(item.text)}`}
      title="Restore"
      data-overview-focus={focusKey}
      onClick={() => onRestorePlan(item, focusKey)}
      className={ICON_BUTTON_CLASS}
    >
      <Undo2 aria-hidden="true" className="size-4" />
    </button>
  );
}

/**
 * The dedicated week-move icon. It activates the same move handler the
 * overflow menu entry uses, so one card offers one move contract.
 */
function MoveAction({
  item,
  move,
}: {
  readonly item: StatusOverviewItem;
  readonly move: ActionProps["onMoveItem"];
}) {
  if (!move) return null;
  const toNext = item.source === "current";
  const label = toNext
    ? `Move ${shortItemLabel(item.text)} to next week`
    : `Move ${shortItemLabel(item.text)} to current week`;
  const focusKey = weekMoveFocusKey(item);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-overview-focus={focusKey}
      onClick={() => move(item, toNext ? "next" : "current", focusKey)}
      className={ICON_BUTTON_CLASS}
    >
      {toNext ? (
        <ArrowRight aria-hidden="true" className="size-4" />
      ) : (
        <ArrowLeft aria-hidden="true" className="size-4" />
      )}
    </button>
  );
}

function EditAction({
  item,
  edit,
}: {
  readonly item: StatusOverviewItem;
  readonly edit: ((target: StatusOverviewEditTarget) => void) | undefined;
}) {
  const target = item.editTarget;
  if (!edit || target === null) return null;
  const label = `Edit details: ${shortItemLabel(item.text)}`;
  const focusKey = `edit-details:${item.source}:${identityOf(item)}`;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-overview-focus={focusKey}
      onClick={() => edit(target)}
      className={ICON_BUTTON_CLASS}
    >
      <Pencil aria-hidden="true" className="size-4" />
    </button>
  );
}

function CommentAction({ item }: { readonly item: StatusOverviewItem }) {
  // The lead surface reads the record's reviewer comments; the anchor only
  // exists while the card actually renders that stack, so a click without
  // comments is a no-op.
  const target = item.editTarget;
  if (target === null) return null;
  const label = `Comments on ${shortItemLabel(item.text)}`;
  const focusKey = `comment:${item.source}:${identityOf(item)}`;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-overview-focus={focusKey}
      onClick={() =>
        focusReviewRecord(reviewRecordAnchor("item", target.recordId))
      }
      className={ICON_BUTTON_CLASS}
    >
      <MessageSquarePlus aria-hidden="true" className="size-4" />
    </button>
  );
}

/**
 * Revealed on hover, focus within and tap: the week-move, edit and comment
 * icons, the overflow menu (which keeps the same move entry) and the recovery
 * actions. Renders nothing when none applies.
 */
export function ItemActionZone(props: ActionProps) {
  const overflow = overflowHandlers(props);
  const recovery = statusOverviewItemActions(props.item).recovery;
  const hasOverflow =
    props.item.editTarget !== null &&
    Boolean(overflow.edit ?? overflow.move ?? overflow.status);
  const hasPlan = props.onPlanItem !== undefined && recovery.includes("replan");
  const hasRestore =
    props.onRestorePlan !== undefined && recovery.includes("restore");
  if (!hasOverflow && !hasPlan && !hasRestore) return null;
  return (
    <div data-overview-item-actions className={REVEAL_CLASS}>
      <MoveAction item={props.item} move={overflow.move} />
      <EditAction item={props.item} edit={overflow.edit} />
      <CommentAction item={props.item} />
      <MoreActions item={props.item} {...overflow} />
      <PlanAction {...props} />
      <RestoreAction {...props} />
    </div>
  );
}
