import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { shortItemLabel } from "../../../shared/lib/format/short-label";
import { reviewRecordAnchor } from "../../../shared/ui/feedback/review-record-focus";
import type {
  StatusOverviewEditTarget,
  StatusOverviewItem,
} from "../model/status-overview";
import {
  overviewDraggableId,
  overviewItemMovable,
} from "../model/status-overview-dnd";
import { statusOverviewItemActions } from "../model/status-overview-items";
import {
  type ActionProps,
  ICON_BUTTON_CLASS,
  StatusControl,
  weekMoveFocusKey,
} from "./status-overview-item-actions";
import { ItemBadges, ResolutionNote } from "./status-overview-item-metadata";
import { ItemActionZone } from "./status-overview-item-overflow";
import { StatusOverviewItemTextEditor } from "./status-overview-item-text-editor";
import { OutcomeAudit } from "./status-overview-outcome-audit";
import { TrackedWorkComments } from "./status-overview-record-comments";
import { StatusInput } from "./status-overview-status-input";
import { VerdictRail, VerdictStamp } from "./status-overview-verdict-controls";
import { useOverviewStatusInput } from "./use-overview-status-input";

const LONG_UPDATE_LENGTH = 120;

const DRAG_HANDLE_LABEL = "Drag to move to another week";
// Hidden at rest on hoverable pointers, revealed with the card chrome, and
// always present where hover cannot exist.
const DRAG_HANDLE_CLASS = `${ICON_BUTTON_CLASS} cursor-grab opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100 active:cursor-grabbing [@media(hover:none)]:opacity-100`;

function isEditableElement(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("input, textarea, select, [contenteditable]") !== null
  );
}

type DragGesture = (event: SyntheticEvent) => void;

// The grip is the only drag start: the dnd listeners live on the handle, so
// the card body keeps its ordinary gestures (text selection, its controls).
// The card root stays the draggable node — it carries the marker the drop
// measurement reads and the translate while the drag is in flight. Non-movable
// cards render exactly as before: no marker, no touch-action override. pan-y
// keeps the column scrollable on touch while the long-press drag still wins
// once the TouchSensor delay elapses.
function useCardDrag(item: StatusOverviewItem, enabled: boolean) {
  const draggable = useDraggable({
    id: overviewDraggableId(item),
    data: { item },
    disabled: !enabled,
  });
  const listeners = enabled ? draggable.listeners : undefined;
  const gesture = (name: "onPointerDown" | "onTouchStart"): DragGesture =>
    // SyntheticListenerMap values are loosely typed; both sensors attach
    // React synthetic-event handlers.
    (listeners?.[name] as DragGesture | undefined) ?? (() => undefined);
  const transform = enabled ? draggable.transform : null;
  const style: CSSProperties =
    transform === null
      ? { touchAction: "pan-y" }
      : {
          transform: `translate3d(${String(transform.x)}px, ${String(transform.y)}px, 0)`,
          position: "relative",
          zIndex: 10,
          touchAction: "pan-y",
        };
  return {
    nodeRef: draggable.setNodeRef,
    activatorRef: draggable.setActivatorNodeRef,
    rootProps: enabled ? { "data-draggable-item": "", style } : undefined,
    handleProps: enabled
      ? {
          ...draggable.attributes,
          onPointerDown: gesture("onPointerDown"),
          onTouchStart: gesture("onTouchStart"),
        }
      : undefined,
  };
}

type CardDrag = ReturnType<typeof useCardDrag>;

// The grip renders only on movable cards. The activator ref goes through a
// callback ref so the dnd ref-callback stays out of the JSX value position.
function DragHandle({ drag }: { readonly drag: CardDrag }) {
  if (drag.handleProps === undefined) return null;
  return (
    <button
      ref={(element) => drag.activatorRef(element)}
      type="button"
      aria-label={DRAG_HANDLE_LABEL}
      title={DRAG_HANDLE_LABEL}
      className={DRAG_HANDLE_CLASS}
      {...drag.handleProps}
    >
      <GripVertical aria-hidden="true" className="size-4" />
    </button>
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

export function StatusOverviewItemPreview(props: ActionProps) {
  const { item, onSetStatus, onConfirmItem, onVerdict } = props;
  const [expanded, setExpanded] = useState(false);
  const statusFlow = useOverviewStatusInput(item, onSetStatus);
  const preview = useRef<HTMLDivElement>(null);
  const drag = useCardDrag(
    item,
    props.onMoveItem !== undefined && overviewItemMovable(item),
  );
  const verdict = itemVerdict(item);
  const pendingVerdict = verdict === "pending" && onVerdict !== undefined;
  const decidedVerdict = verdict !== undefined && verdict !== "pending";
  const verdictStamp = decidedVerdict ? verdict : undefined;
  return (
    <div
      ref={(element) => {
        preview.current = element;
        drag.nodeRef(element);
      }}
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
      {...drag.rootProps}
      onKeyDown={(event) => handleWeekMoveKey(event, item, props.onMoveItem)}
      className="group/item flex min-w-0 items-start gap-1 rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] md:h-full"
    >
      <DragHandle drag={drag} />
      <StatusControl
        item={item}
        onSetStatus={onSetStatus ? statusFlow.choose : undefined}
        onConfirmItem={onConfirmItem}
        lockReason={statusFlow.lockReason}
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <PreviewText
          item={item}
          expanded={expanded}
          onEditItem={props.onEditItem}
          onEditItemText={props.onEditItemText}
        />
        <ItemBadges item={item} />
        <StatusInput item={item} flow={statusFlow} />
        {pendingVerdict ? (
          <VerdictRail
            item={item}
            onVerdict={onVerdict}
            onDecided={() => focusVerdictStamp(preview.current)}
          />
        ) : null}
        <OutcomeAudit item={item} />
        <TrackedWorkComments item={item} />
        <TextDisclosure
          item={item}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />
      </div>
      <div className="flex min-h-[var(--touch-target-min)] shrink-0 items-center">
        {verdictStamp !== undefined ? (
          <VerdictStamp verdict={verdictStamp} />
        ) : null}
        <ItemActionZone {...props} />
      </div>
    </div>
  );
}
