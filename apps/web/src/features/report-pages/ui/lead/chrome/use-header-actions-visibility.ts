"use client";

import { useCallback, useEffect, useState } from "react";

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

  // Without a sentinel or observer, actions remain visible. After observing a
  // target, the last measurement remains until the asynchronous callback runs.
  const headerActionsVisible =
    !target || typeof IntersectionObserver === "undefined"
      ? true
      : observedVisible;

  return { headerActionsVisible, sentinelRef };
}
