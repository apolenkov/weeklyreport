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

// Left-anchored and width-matched so the panel lines up under the trigger.
// Module-level so its identity stays stable across renders — the anchoring
// effect keys on it and would otherwise re-bind its scroll/resize listeners.
const leftAnchoredPosition = (rect: DOMRect) => ({
  top: rect.bottom + ANCHORED_PANEL_GAP_PX,
  left: rect.left,
  width: rect.width,
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
