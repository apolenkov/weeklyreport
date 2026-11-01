import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { type CSSProperties, type SyntheticEvent } from "react";

import type { StatusOverviewItem } from "../model/status-overview";
import { overviewDraggableId } from "../model/status-overview-dnd";
import type { PlanVerdict } from "../model/status-overview-verdict";
import {
  type ActionProps,
  OVERLAY_BUTTON_CLASS,
} from "./status-overview-item-actions";
import {
  ItemActionZone,
  itemHasActionZone,
} from "./status-overview-item-overflow";
import { VerdictStamp } from "./status-overview-verdict-controls";

const DRAG_HANDLE_LABEL = "Drag to move to another week";
// The grip lives in the card's floating chip, so its reveal belongs to the
// chip, not to the handle itself.
const DRAG_HANDLE_CLASS = `${OVERLAY_BUTTON_CLASS} cursor-grab active:cursor-grabbing`;

// The grip, the action cluster and the verdict stamp float as one chip over
// the card's top-right corner, so the text keeps the card's full width.
// Hidden by opacity and pointer-events only — never display or visibility —
// the controls stay in the accessibility tree and the Tab order. The chip
// reveals on hover, on focus within the card, while a menu is open, and
// always where hover cannot exist; there it drops to a static row below the
// text instead of overlapping it.
const OVERLAY_CHIP_CLASS =
  "flex items-center gap-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] p-0.5 shadow-sm";
const OVERLAY_FLOAT_CLASS =
  "absolute right-0 top-0 [@media(hover:none)]:order-last [@media(hover:none)]:mt-1 [@media(hover:none)]:static [@media(hover:none)]:w-full";
const OVERLAY_REVEAL_CLASS =
  "pointer-events-none opacity-0 transition-[opacity] group-hover/item:pointer-events-auto group-hover/item:opacity-100 group-focus-within/item:pointer-events-auto group-focus-within/item:opacity-100 has-[[data-state=open]]:pointer-events-auto has-[[data-state=open]]:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100 motion-reduce:transition-none";

type DragGesture = (event: SyntheticEvent) => void;

// The grip is the only drag start: the dnd listeners live on the handle, so
// the card body keeps its ordinary gestures (text selection, its controls).
// The card root stays the draggable node — it carries the marker the drop
// measurement reads and the translate while the drag is in flight. Non-movable
// cards render exactly as before: no marker, no touch-action override. pan-y
// keeps the column scrollable on touch while the long-press drag still wins
// once the TouchSensor delay elapses.
export function useCardDrag(item: StatusOverviewItem, enabled: boolean) {
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
          transform: `translate3d(${String(transform.x)}px, ${String(
            transform.y,
          )}px, 0)`,
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

export type CardDrag = ReturnType<typeof useCardDrag>;

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

/**
 * The grip, the action icons and the verdict stamp as one floating chip in
 * the card's top-right corner. Renders nothing when it has no content — an
 * empty bordered box would still take a row on touch.
 */
export function ItemActionChip({
  actionProps,
  drag,
  verdictStamp,
}: {
  readonly actionProps: ActionProps;
  readonly drag: CardDrag;
  readonly verdictStamp?: PlanVerdict | undefined;
}) {
  if (
    verdictStamp === undefined &&
    drag.handleProps === undefined &&
    !itemHasActionZone(actionProps)
  ) {
    return null;
  }
  // A stamped Previous row shows its chip at rest: the verdict is a frozen
  // indicator, not a hover action.
  const reveal =
    verdictStamp !== undefined
      ? "pointer-events-auto opacity-100"
      : OVERLAY_REVEAL_CLASS;
  return (
    <div
      data-overview-item-actions
      className={`${OVERLAY_FLOAT_CLASS} ${OVERLAY_CHIP_CLASS} ${reveal}`}
    >
      <DragHandle drag={drag} />
      <ItemActionZone {...actionProps} />
      {verdictStamp !== undefined ? (
        <VerdictStamp verdict={verdictStamp} />
      ) : null}
    </div>
  );
}
