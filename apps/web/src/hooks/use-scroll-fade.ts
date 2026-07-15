"use client";

import { type RefObject, useEffect, useState } from "react";

// Pixel slack below the fold before the fade affordance hides — avoids
// flicker from sub-pixel scroll-height rounding.
const SCROLL_FADE_THRESHOLD_PX = 4;

/**
 * Whether a scroll container has more content below the fold — drives a
 * bottom fade-out affordance. Re-checks on scroll, resize, and child-content
 * mutations, and tolerates SSR / jsdom where either observer is absent.
 */
export function useScrollFade(ref: RefObject<HTMLElement | null>): boolean {
  const [canScrollDown, setCanScrollDown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      setCanScrollDown(
        el.scrollTop + el.clientHeight <
          el.scrollHeight - SCROLL_FADE_THRESHOLD_PX,
      );
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    const mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver(check)
        : null;
    mo?.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", check);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [ref]);
  return canScrollDown;
}
