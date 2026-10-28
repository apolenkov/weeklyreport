"use client";

import { type RefObject, useEffect, useState } from "react";

// Gap between the trigger and the panel portaled out of the toolbar.
export const ANCHORED_PANEL_GAP_PX = 4;

const PANEL_VIEWPORT_GUTTER_PX = 16;
const DEFAULT_ANCHORED_PANEL_MAX_HEIGHT_PX = 280;

export interface AnchoredPanelCoordinates {
  readonly top?: number | undefined;
  readonly bottom?: number | undefined;
  readonly left: number;
  readonly width: number;
  readonly maxHeight?: number | undefined;
}

export interface AnchoredPanelOptions {
  readonly viewportHeight?: number;
  readonly preferredMaxHeight?: number;
}

// Right-aligned to the trigger, then clamped so a narrow viewport never pushes
// the panel past either edge: width shrinks to the viewport, left stays inside
// the gutter. Vertically clamped and flips above if there is more room above
// when below is constrained.
export function rightAlignedClampedPosition(
  rect: {
    readonly bottom: number;
    readonly right: number;
    readonly top?: number;
  },
  viewportWidth: number,
  preferredWidth: number,
  options?: AnchoredPanelOptions,
): AnchoredPanelCoordinates {
  const width = Math.min(
    preferredWidth,
    viewportWidth - 2 * PANEL_VIEWPORT_GUTTER_PX,
  );
  const left = Math.min(
    Math.max(rect.right - width, PANEL_VIEWPORT_GUTTER_PX),
    viewportWidth - PANEL_VIEWPORT_GUTTER_PX - width,
  );

  const viewportHeight = options?.viewportHeight;
  if (viewportHeight === undefined) {
    return { top: rect.bottom + ANCHORED_PANEL_GAP_PX, left, width };
  }

  const roomBelow = Math.max(
    0,
    viewportHeight -
      PANEL_VIEWPORT_GUTTER_PX -
      rect.bottom -
      ANCHORED_PANEL_GAP_PX,
  );
  const preferredMaxHeight =
    options?.preferredMaxHeight ?? DEFAULT_ANCHORED_PANEL_MAX_HEIGHT_PX;
  const roomAbove = Math.max(
    0,
    (rect.top ?? 0) - ANCHORED_PANEL_GAP_PX - PANEL_VIEWPORT_GUTTER_PX,
  );
  const above = roomBelow < preferredMaxHeight && roomAbove > roomBelow;

  return {
    top: above
      ? undefined
      : Math.max(PANEL_VIEWPORT_GUTTER_PX, rect.bottom + ANCHORED_PANEL_GAP_PX),
    bottom: above
      ? Math.max(
          PANEL_VIEWPORT_GUTTER_PX,
          viewportHeight - (rect.top ?? 0) + ANCHORED_PANEL_GAP_PX,
        )
      : undefined,
    maxHeight: Math.min(preferredMaxHeight, above ? roomAbove : roomBelow),
    left,
    width,
  };
}

// Panels are portaled to escape the toolbar's overflow clip, so their position
// has to be measured from the trigger and re-measured whenever it moves. Scroll
// is captured because the trigger's own scroll container never bubbles.
export function useAnchoredPanelPosition<T>(
  open: boolean,
  triggerRef: RefObject<HTMLButtonElement | null>,
  project: (rect: DOMRect) => T,
): T | null {
  const [position, setPosition] = useState<T | null>(null);
  // Drop stale coordinates the moment the panel closes (render-phase reset):
  // the panel is gated on position !== null, so without it a reopen after the
  // trigger moved would paint one frame at the old spot before the measure
  // below lands.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setPosition(null);
  }

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
