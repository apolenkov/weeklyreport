"use client";

import { useEffect } from "react";

// Stacked dialogs (an editor plus its confirm) share one lock: the first
// mount captures the page's overflow, the last unmount restores it, so
// non-LIFO unmounts cannot leave the page locked. `overflow: hidden` freezes
// the viewport scroller without moving it, so scroll position is preserved.
const lock = { count: 0, previousOverflow: "" };

export function useBodyScrollLock(): void {
  useEffect(() => {
    const { style } = document.body;
    if (lock.count === 0) lock.previousOverflow = style.overflow;
    lock.count += 1;
    style.overflow = "hidden";
    return () => {
      lock.count -= 1;
      if (lock.count === 0) style.overflow = lock.previousOverflow;
    };
  }, []);
}
