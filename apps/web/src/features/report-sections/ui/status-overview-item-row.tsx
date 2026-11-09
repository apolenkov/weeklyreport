import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  MessageSquare,
  Pencil,
  Undo2,
} from "lucide-react";
import type { RefObject } from "react";

import { shortItemLabel } from "../../../shared/lib/format/short-label";
import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
import { canDiscussItem } from "../model/status-overview-discussion";
import { statusOverviewItemActions } from "../model/status-overview-items";
import type { PlanVerdict } from "../model/status-overview-verdict";
import {
  type ActionProps,
  identityOf,
  ROW_BUTTON_CLASS,
  weekMoveFocusKey,
} from "./status-overview-item-actions";
import { VerdictStamp } from "./status-overview-verdict-controls";

// Where hover exists the row floats over the card's top-right corner on a
// card-coloured chip, so the text keeps the full column width and revealing it
// changes opacity only — never layout. Hidden by opacity and pointer-events,
// never display or visibility, so the controls stay in the accessibility tree
// and the Tab order. It shows on hover, on focus within the card, while a
// control is open, and always where hover cannot exist; there it sits in flow
// on its own row below the text.
const ROW_CLASS =
  "flex shrink-0 items-center gap-0.5 [@media(hover:none)]:order-last [@media(hover:none)]:w-full [@media(hover:none)]:flex-wrap [@media(hover:none)]:pl-[var(--touch-target-min)]";
const ROW_REVEAL_CLASS =
  "absolute top-0 right-0 z-10 rounded-[var(--radius-sm)] bg-[var(--color-card)] shadow-sm [@media(hover:none)]:static [@media(hover:none)]:shadow-none pointer-events-none opacity-0 transition-[opacity] group-has-[textarea:focus]/item:pointer-events-none! group-has-[textarea:focus]/item:opacity-0! group-hover/item:pointer-events-auto group-hover/item:opacity-100 group-focus-within/item:pointer-events-auto group-focus-within/item:opacity-100 has-[[data-state=open]]:pointer-events-auto has-[[data-state=open]]:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100 motion-reduce:transition-none";

interface RowHandlers {
  readonly edit: ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly move: ActionProps["onMoveItem"];
}

function rowHandlers({
  item,
  onEditItem,
  onMoveItem,
}: ActionProps): RowHandlers {
  const secondary = statusOverviewItemActions(item).secondary;
  const target = item.editTarget;
  return {
    edit:
      target !== null && secondary.includes("edit") ? onEditItem : undefined,
    move:
      target !== null && secondary.includes("move") ? onMoveItem : undefined,
  };
}

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
      className={ROW_BUTTON_CLASS}
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
      className={ROW_BUTTON_CLASS}
    >
      <Pencil aria-hidden="true" className="size-4" />
    </button>
  );
}

function CommentAction({
  item,
  open,
  controls,
  onToggle,
  buttonRef,
}: {
  readonly item: StatusOverviewItem;
  readonly open: boolean;
  readonly controls: string;
  readonly onToggle: () => void;
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  if (!canDiscussItem(item)) return null;
  const label = `Comments on ${shortItemLabel(item.text)}`;
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      title={label}
      data-overview-focus={`comment:${item.source}:${identityOf(item)}`}
      onClick={onToggle}
      className={ROW_BUTTON_CLASS}
    >
      <MessageSquare aria-hidden="true" className="size-4" />
    </button>
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
      className={ROW_BUTTON_CLASS}
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
      className={ROW_BUTTON_CLASS}
    >
      <Undo2 aria-hidden="true" className="size-4" />
    </button>
  );
}

function hasRowActions(props: ActionProps): boolean {
  const { edit, move } = rowHandlers(props);
  const recovery = statusOverviewItemActions(props.item).recovery;
  return (
    (props.item.editTarget !== null && Boolean(edit ?? move)) ||
    (props.onPlanItem !== undefined && recovery.includes("replan")) ||
    (props.onRestorePlan !== undefined && recovery.includes("restore"))
  );
}

/**
 * One flat row of card actions — week move, edit, comments, and the recovery
 * actions — with no nested menu. A decided Previous verdict shows its stamp
 * here at rest. Renders nothing when nothing applies.
 */
export function ItemActionRow({
  actionProps,
  verdictStamp,
  commentsOpen,
  commentsId,
  onToggleComments,
  commentButtonRef,
}: {
  readonly actionProps: ActionProps;
  readonly verdictStamp?: PlanVerdict | undefined;
  readonly commentsOpen: boolean;
  readonly commentsId: string;
  readonly onToggleComments: () => void;
  readonly commentButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  if (verdictStamp !== undefined) {
    return (
      <div data-overview-item-actions className={ROW_CLASS}>
        <VerdictStamp verdict={verdictStamp} />
      </div>
    );
  }
  if (!hasRowActions(actionProps)) return null;
  const { edit, move } = rowHandlers(actionProps);
  return (
    <div
      data-overview-item-actions
      className={`${ROW_CLASS} ${ROW_REVEAL_CLASS}`}
    >
      <MoveAction item={actionProps.item} move={move} />
      <EditAction item={actionProps.item} edit={edit} />
      <CommentAction
        item={actionProps.item}
        open={commentsOpen}
        controls={commentsId}
        onToggle={onToggleComments}
        buttonRef={commentButtonRef}
      />
      <PlanAction {...actionProps} />
      <RestoreAction {...actionProps} />
    </div>
  );
}
