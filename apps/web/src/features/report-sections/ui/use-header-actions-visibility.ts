"use client";

import { useCallback, useEffect, useState } from "react";

export function useHeaderActionsVisibility() {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const [headerActionsVisible, setHeaderActionsVisible] = useState(true);
  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    setTarget(node);
  }, []);

  useEffect(() => {
    if (!target || typeof IntersectionObserver === "undefined") {
      setHeaderActionsVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      setHeaderActionsVisible(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [target]);

  return { headerActionsVisible, sentinelRef };
}
