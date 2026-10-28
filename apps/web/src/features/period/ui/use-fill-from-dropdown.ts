"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDismissOnOutsidePointer } from "../../../shared/hooks/browser/use-dismiss-on-outside-pointer";
import {
  rightAlignedClampedPosition,
  useAnchoredPanelPosition,
} from "../model/use-anchored-panel-position";

const PANEL_WIDTH_PX = 340;

const fillPanelPosition = (rect: DOMRect) =>
  rightAlignedClampedPosition(rect, window.innerWidth, PANEL_WIDTH_PX, {
    viewportHeight: window.innerHeight,
  });

function useCloseOnEscape(open: boolean, close: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    if (open) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);
}

export function useFillFromDropdown() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pos = useAnchoredPanelPosition(open, triggerRef, fillPanelPosition);

  // Every close path clears the leftover query too, so reopening always starts
  // unfiltered rather than pre-filtered by whatever was typed before.
  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  // The panel is portalled out of the trigger's subtree, so it contributes its
  // own ref alongside the wrapper.
  useDismissOnOutsidePointer({
    open,
    refs: [wrapRef, panelRef],
    onDismiss: close,
  });
  useCloseOnEscape(open, close);

  return {
    open,
    search,
    setSearch,
    pos,
    wrapRef,
    triggerRef,
    panelRef,
    close,
    toggle: () => (open ? close() : setOpen(true)),
  };
}
