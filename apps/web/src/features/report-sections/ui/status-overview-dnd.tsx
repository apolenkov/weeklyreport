"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { ReactNode } from "react";

import type { StatusOverviewItem } from "../model/status-overview";
import {
  type OverviewDropColumn,
  resolveDrop,
} from "../model/status-overview-dnd";
import { weekMoveFocusKey } from "./status-overview-item-actions";
import type { ItemHandlers } from "./status-overview-item-handlers";

// A click must read as a click, not a drag start: pointer drags arm only after
// a small movement, touch drags after a long press so scrolling and tapping
// stay unambiguous.
function useOverviewSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );
}

/**
 * Drag layer for the Overview lanes. A release resolves to a week move through
 * the same `onMoveItem` handler the icon and keyboard paths use; anything else
 * (own lane, Previous, outside) snaps the card back untouched. Keyboard moves
 * stay on the explicit Alt+Arrow handler, so no KeyboardSensor is registered.
 *
 * The built-in a11y markup (hidden instructions and the assertive live region
 * that narrates drags) is portaled to the body: it must not sit inside the
 * Overview section, which already owns a single polite status element. The
 * default instructions describe a keyboard lift that no sensor provides, so
 * they are replaced by the move path that actually exists for screen readers.
 */
export function OverviewDragContext({
  onMoveItem,
  children,
}: {
  readonly onMoveItem: ItemHandlers["onMoveItem"];
  readonly children: ReactNode;
}) {
  const sensorsList = useOverviewSensors();
  // document is absent during SSR; the a11y markup itself renders only after
  // mount, so by the time this prop is read the host always exists.
  const liveRegionHost =
    typeof document === "undefined" ? undefined : document.body;
  const endDrag = (event: DragEndEvent): void => {
    const item = event.active.data.current?.item as
      StatusOverviewItem | undefined;
    const column = event.over?.data.current?.column as
      OverviewDropColumn | undefined;
    const target = resolveDrop(item, column);
    if (item === undefined || target === null) return;
    onMoveItem?.(item, target, weekMoveFocusKey(item));
  };
  return (
    <DndContext
      sensors={sensorsList}
      collisionDetection={pointerWithin}
      accessibility={{
        ...(liveRegionHost === undefined ? {} : { container: liveRegionHost }),
        screenReaderInstructions: {
          draggable:
            "To move this item to another week, use Move in its More actions menu.",
        },
      }}
      onDragEnd={endDrag}
    >
      {children}
    </DndContext>
  );
}
