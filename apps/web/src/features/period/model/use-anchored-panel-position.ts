"use client";

import { type RefObject, useEffect, useState } from "react";

// Gap between the trigger and the panel portaled out of the toolbar.
export const ANCHORED_PANEL_GAP_PX = 4;

// Panels are portaled to escape the toolbar's overflow clip, so their position
// has to be measured from the trigger and re-measured whenever it moves. Scroll
// is captured because the trigger's own scroll container never bubbles.
export function useAnchoredPanelPosition<T>(
  open: boolean,
  triggerRef: RefObject<HTMLButtonElement | null>,
  project: (rect: DOMRect) => T,
): T | null {
  const [position, setPosition] = useState<T | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(project(rect));
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, triggerRef, project]);

  return position;
}
