import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { shortItemLabel } from "../../../shared/lib/format/short-label";
import { reviewRecordAnchor } from "../../../shared/ui/feedback/review-record-focus";
import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
import { statusOverviewItemActions } from "../model/status-overview-items";
import { StatusOverviewCommentsView } from "./status-overview-comments-view";
import {
  type ActionProps,
  weekMoveFocusKey,
} from "./status-overview-item-actions";
import { ItemBadges, ResolutionNote } from "./status-overview-item-metadata";
import { ItemActionRow } from "./status-overview-item-row";
import { StatusOverviewItemTextEditor } from "./status-overview-item-text-editor";
import { OutcomeAudit } from "./status-overview-outcome-audit";
import { TrackedWorkComments } from "./status-overview-record-comments";
import { canSetStages, StageControl } from "./status-overview-stage-control";
import { StatusControl } from "./status-overview-status-control";
import { StatusInput } from "./status-overview-status-input";
import { VerdictRail } from "./status-overview-verdict-controls";
import { useOverviewStatusInput } from "./use-overview-status-input";

const LONG_UPDATE_LENGTH = 120;

function isEditableElement(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]") !== null
  );
}

function itemVerdict(item: StatusOverviewItem) {
  return item.source === "previous" ? item.verdict : undefined;
}

// The rail is replaced by the stamp once a verdict lands: move focus there.
function focusVerdictStamp(preview: HTMLElement | null): void {
  requestAnimationFrame(() =>
    (
      preview?.querySelector<HTMLElement>("[data-verdict-stamp]") ?? preview
    )?.focus(),
  );
}

/**
 * Alt+ArrowRight moves a focused Current card to Next, Alt+ArrowLeft a Next
 * card to Current; every other combination is a no-op. The card is not a Tab
 * stop, so focus reaches it from inside; typing in the inline editor or a
 * status reason must never move the card.
 */
function handleWeekMoveKey(
  event: KeyboardEvent<HTMLDivElement>,
  item: StatusOverviewItem,
  onMoveItem: ActionProps["onMoveItem"],
): void {
  if (onMoveItem === undefined) return;
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  if (isEditableElement(event.target)) return;
  if (!statusOverviewItemActions(item).secondary.includes("move")) return;
  const toNext = item.source === "current";
  if (event.key !== (toNext ? "ArrowRight" : "ArrowLeft")) return;
  event.preventDefault();
  onMoveItem(item, toNext ? "next" : "current", weekMoveFocusKey(item));
}

function previewTextClassName(expanded: boolean, canCollapse: boolean): string {
  return `${expanded || !canCollapse ? "block" : "line-clamp-2"} min-w-0 break-words text-sm leading-5`;
}

function PreviewText({
  item,
  expanded,
  onEditItem,
  onEditItemText,
}: {
  readonly item: StatusOverviewItem;
  readonly expanded: boolean;
  readonly onEditItem?:
    ((target: StatusOverviewEditTarget) => void) | undefined;
  readonly onEditItemText?: ActionProps["onEditItemText"];
}) {
  const canCollapse = item.text.length > LONG_UPDATE_LENGTH;
  const textClassName = previewTextClassName(expanded, canCollapse);
  const [editing, setEditing] = useState(false);
  // Keyboard closes (Enter, Escape) return focus to the title button; a blur
  // commit leaves focus where the pointer put it.
  const restoreFocus = useRef(false);
  const titleRef = useRef<HTMLButtonElement>(null);
  const editTarget = item.editTarget;
  const interactive =
    editTarget !== null &&
    item.resolution == null &&
    item.workflowStatus !== "done";
  // The linked Next projection shows the Current record's next step, not its
  // description, so its text click keeps opening the canonical editor focused
  // on that field.
  const canInlineEdit =
    interactive &&
    editTarget.focusNextStep !== true &&
    onEditItemText !== undefined;
  const canOpenEditor = interactive && onEditItem !== undefined;
  const interactiveTitle = canInlineEdit || canOpenEditor;
  useEffect(() => {
    if (editing || !restoreFocus.current) return;
    restoreFocus.current = false;
    requestAnimationFrame(() => titleRef.current?.focus());
  }, [editing]);
  const openEditor = (): void => {
    if (canInlineEdit) setEditing(true);
    else if (editTarget !== null) onEditItem?.(editTarget);
  };
  const closeEditor = (viaKeyboard: boolean): void => {
    restoreFocus.current = viaKeyboard;
    setEditing(false);
  };
  return (
    <div className="min-w-0">
      {editing && canInlineEdit ? (
        <StatusOverviewItemTextEditor
          label={`Edit item text: ${item.text}`}
          text={item.text}
          onSave={(text, viaKeyboard) => {
            onEditItemText(item, text);
            closeEditor(viaKeyboard);
          }}
          onCancel={closeEditor}
        />
      ) : interactiveTitle ? (
        <button
          ref={titleRef}
          type="button"
          aria-label={`Edit item: ${item.text}`}
          data-overview-focus={`title:${item.source}:${item.stableId ?? item.key}`}
          onClick={openEditor}
          className="-mx-1 flex min-h-[var(--touch-target-min)] w-[calc(100%+0.5rem)] items-center rounded-[var(--radius-sm)] px-1 text-left hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <span className={textClassName}>{item.text}</span>
        </button>
      ) : (
        <div className="flex min-h-[var(--touch-target-min)] items-center">
          <p className={textClassName}>{item.text}</p>
        </div>
      )}
      <ResolutionNote item={item} />
    </div>
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
      aria-label={`${label}: ${shortItemLabel(item.text)}`}
      onClick={onToggle}
      className="min-h-[var(--touch-target-min)] rounded-[var(--radius-sm)] px-1 text-xs text-[var(--color-primary)] underline underline-offset-4 hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      {label}
    </button>
  );
}

function useItemComments(
  item: StatusOverviewItem,
  preview: React.RefObject<HTMLDivElement | null>,
) {
  const [openCommentsKey, setOpenCommentsKey] = useState<string | null>(null);
  const [previousItemKey, setPreviousItemKey] = useState(item.key);
  if (previousItemKey !== item.key) {
    setPreviousItemKey(item.key);
    setOpenCommentsKey(null);
  }
  const commentsOpen = openCommentsKey === item.key;
  const commentsId = useId();
  const commentButtonRef = useRef<HTMLButtonElement>(null);
  const closeComments = () => {
    setOpenCommentsKey(null);
    commentButtonRef.current?.focus();
  };
  useEffect(() => {
    if (commentsOpen && document.activeElement === commentButtonRef.current) {
      document
        .getElementById(commentsId)
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus();
    }
  }, [commentsOpen, commentsId, preview]);
  const onCardFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (
      event.target === event.currentTarget &&
      item.comments.length > 0 &&
      item.editTarget !== null
    )
      setOpenCommentsKey(item.key);
  };
  const toggleComments = () =>
    setOpenCommentsKey(commentsOpen ? null : item.key);
  return {
    commentsOpen,
    commentsId,
    commentButtonRef,
    closeComments,
    toggleComments,
    onCardFocus,
  };
}

function StageLabels(props: ActionProps) {
  return canSetStages(props) ? (
    <StageControl {...props} />
  ) : (
    <ItemBadges item={props.item} />
  );
}

export function StatusOverviewItemPreview(props: ActionProps) {
  const { item, onSetStatus, onConfirmItem, onVerdict } = props;
  const [expanded, setExpanded] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const comments = useItemComments(item, preview);
  const statusFlow = useOverviewStatusInput(item, onSetStatus);
  const verdict = itemVerdict(item);
  const pendingVerdict = verdict === "pending" && onVerdict !== undefined;
  const decidedVerdict = verdict !== undefined && verdict !== "pending";
  const verdictStamp = decidedVerdict ? verdict : undefined;
  return (
    <div
      ref={preview}
      id={
        item.recordId && item.comments.length > 0
          ? reviewRecordAnchor("item", item.recordId)
          : undefined
      }
      // The card is one focusable group of controls; the group role keeps
      // the week-move keydown handler on the container lint-legitimate.
      role="group"
      tabIndex={-1}
      data-overview-item-preview
      onFocus={comments.onCardFocus}
      onKeyDown={(event) => handleWeekMoveKey(event, item, props.onMoveItem)}
      className="group/item relative flex min-w-0 items-start gap-1 rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-primary)] [@media(hover:none)]:flex-wrap md:h-full"
    >
      <StatusControl
        item={item}
        onSetStatus={onSetStatus ? statusFlow.choose : undefined}
        onConfirmItem={onConfirmItem}
        onResolvePlan={props.onResolvePlan}
        lockReason={statusFlow.lockReason}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <PreviewText
          item={item}
          expanded={expanded}
          onEditItem={props.onEditItem}
          onEditItemText={props.onEditItemText}
        />
        <StageLabels {...props} />
        <StatusInput item={item} flow={statusFlow} />
        {pendingVerdict ? (
          <VerdictRail
            item={item}
            onVerdict={onVerdict}
            onDecided={() => focusVerdictStamp(preview.current)}
          />
        ) : null}
        <OutcomeAudit item={item} />
        {item.editTarget === null || decidedVerdict ? (
          <TrackedWorkComments item={item} />
        ) : comments.commentsOpen ? (
          <StatusOverviewCommentsView
            id={comments.commentsId}
            itemLabel={item.text}
            comments={item.comments}
            onClose={comments.closeComments}
          />
        ) : null}
        <TextDisclosure
          item={item}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />
      </div>
      <ItemActionRow
        actionProps={props}
        verdictStamp={verdictStamp}
        commentsOpen={comments.commentsOpen}
        commentsId={comments.commentsId}
        commentButtonRef={comments.commentButtonRef}
        onToggleComments={comments.toggleComments}
      />
    </div>
  );
}
