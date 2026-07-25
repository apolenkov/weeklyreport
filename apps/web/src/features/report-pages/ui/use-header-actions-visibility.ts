"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Use Header Actions Visibility.
 */
export function useHeaderActionsVisibility() {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [observedVisible, setObservedVisible] = useState(true);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    setTarget(node);
  }, []);

  useEffect(() => {
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      setObservedVisible(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [target]);

  // No sentinel (or no IntersectionObserver) ⇒ visible, derived at render
  // instead of set in the effect. A stale `observedVisible` from a previous
  // sentinel is harmless: the observer callback fires immediately on observe.
  const headerActionsVisible =
    !target || typeof IntersectionObserver === "undefined"
      ? true
      : observedVisible;

  return { headerActionsVisible, sentinelRef };
}
