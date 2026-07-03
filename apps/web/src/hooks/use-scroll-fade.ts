"use client";

import { type RefObject, useEffect, useState } from "react";

/**
 * Whether a scroll container has more content below the fold — drives a
 * bottom fade-out affordance. Re-checks on scroll and on resize, and tolerates
 * SSR / jsdom where `ResizeObserver` is absent.
 */
export function useScrollFade(ref: RefObject<HTMLElement | null>): boolean {
  const [canScrollDown, setCanScrollDown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", check);
      ro?.disconnect();
    };
  }, [ref]);
  return canScrollDown;
}
