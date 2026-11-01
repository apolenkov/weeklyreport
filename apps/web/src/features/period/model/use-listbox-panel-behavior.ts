"use client";

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useEffect,
} from "react";

import { useDismissOnOutsidePointer } from "../../../shared/hooks/browser/use-dismiss-on-outside-pointer";
import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import {
  ANCHORED_PANEL_GAP_PX,
  useAnchoredPanelPosition,
} from "./use-anchored-panel-position";

const PANEL_VIEWPORT_GUTTER_PX = 16;
const PERIOD_PANEL_MAX_HEIGHT_PX = 280;

interface PanelAnchorRect {
  readonly left: number;
  readonly width: number;
  readonly top: number;
  readonly bottom: number;
}

// Left-anchored and width-matched so the panel lines up under the trigger.
// The width becomes the panel's min-width, which outranks max-width in CSS, so
// a trigger wider than the viewport (clipped by its toolbar) must not pass its
// own width through: it is capped to the gutter-to-gutter space, and left is
// clamped so that capped width fits before the right gutter.
export function leftAnchoredPanelPosition(
  rect: PanelAnchorRect,
  viewport: { readonly width: number; readonly height: number },
) {
  const roomBelow = Math.max(
    0,
    viewport.height -
      PANEL_VIEWPORT_GUTTER_PX -
      rect.bottom -
      ANCHORED_PANEL_GAP_PX,
  );
  const roomAbove = Math.max(
    0,
    rect.top - ANCHORED_PANEL_GAP_PX - PANEL_VIEWPORT_GUTTER_PX,
  );
  const above = roomBelow < PERIOD_PANEL_MAX_HEIGHT_PX && roomAbove > roomBelow;
  const width = Math.min(
    rect.width,
    viewport.width - 2 * PANEL_VIEWPORT_GUTTER_PX,
  );
  const left = Math.min(
    Math.max(rect.left, PANEL_VIEWPORT_GUTTER_PX),
    viewport.width - PANEL_VIEWPORT_GUTTER_PX - width,
  );
  return {
    top: above
      ? undefined
      : Math.max(PANEL_VIEWPORT_GUTTER_PX, rect.bottom + ANCHORED_PANEL_GAP_PX),
    bottom: above
      ? Math.max(
          PANEL_VIEWPORT_GUTTER_PX,
          viewport.height - rect.top + ANCHORED_PANEL_GAP_PX,
        )
      : undefined,
    maxHeight: Math.min(
      PERIOD_PANEL_MAX_HEIGHT_PX,
      above ? roomAbove : roomBelow,
    ),
    left,
    width,
  };
}

// Module-level so its identity stays stable across renders — the anchoring
// effect keys on it and would otherwise re-bind its scroll/resize listeners.
const leftAnchoredPosition = (rect: DOMRect) =>
  leftAnchoredPanelPosition(rect, {
    width: window.innerWidth,
    height: window.innerHeight,
  });

// Scroll active option into view; block: "nearest" avoids hover-driven panel jerks.
function useActiveOptionScroll(
  open: boolean,
  activeIdx: number,
  optionIdPrefix: string,
): void {
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${optionIdPrefix}${activeIdx}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIdx, optionIdPrefix]);
}

interface ListboxPanelBehaviorArgs {
  readonly open: boolean;
  readonly setOpen: Dispatch<SetStateAction<boolean>>;
  readonly activeIdx: number;
  readonly optionIdPrefix: string;
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
  readonly panelRef: RefObject<HTMLDivElement | null>;
}

// Everything the portaled listbox panel needs while it is open: anchored
// position, Escape/focus restore, outside-pointer dismiss, highlight in view.
export function useListboxPanelBehavior({
  open,
  setOpen,
  activeIdx,
  optionIdPrefix,
  triggerRef,
  panelRef,
}: ListboxPanelBehaviorArgs) {
  const panelPos = useAnchoredPanelPosition(
    open,
    triggerRef,
    leftAnchoredPosition,
  );

  // containerRef = trigger (not panel): Escape/restore only; no focus into the list.
  useDialogFocus({
    open,
    onClose: () => setOpen(false),
    containerRef: triggerRef,
    triggerRef,
    mode: "nonmodal",
  });

  // The panel is portalled, so a press inside either the trigger or the panel
  // keeps the listbox open.
  useDismissOnOutsidePointer({
    open,
    refs: [triggerRef, panelRef],
    onDismiss: () => setOpen(false),
  });
  useActiveOptionScroll(open, activeIdx, optionIdPrefix);

  return panelPos;
}
