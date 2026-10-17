"use client";

import { useEffect, useRef } from "react";

// Disabling the focused action drops focus to <body>, which the Radix trap does
// not reclaim; park it on the panel so the keyboard stays inside. A focused
// control that is still enabled keeps focus.
export function usePendingFocusPark(isPending: boolean) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!isPending || !panel) return;
    const active = document.activeElement;
    const lost =
      !panel.contains(active) ||
      (active instanceof HTMLButtonElement && active.disabled);
    if (lost) panel.focus();
  }, [isPending]);
  return panelRef;
}
