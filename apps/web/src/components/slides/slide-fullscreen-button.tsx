"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface SlideFullscreenButtonProps {
  readonly targetRef: React.RefObject<HTMLElement | null>;
  readonly variant?: "default" | "floating";
}

export function SlideFullscreenButton({
  targetRef,
  variant = "default",
}: SlideFullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggle = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        /* ignore — denied in iframe contexts */
      });
    } else {
      document.exitFullscreen().catch(() => {
        /* ignore */
      });
    }
  }, [targetRef]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "f" || e.key === "F") toggle();
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKey);
    };
  }, [toggle]);

  if (variant === "floating" && !isFullscreen) return null;

  const floatingClass =
    variant === "floating"
      ? " fixed top-4 right-4 z-50 bg-[var(--color-card)] shadow-lg"
      : "";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      className={`btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]${floatingClass}`}
    >
      {isFullscreen ? (
        <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {isFullscreen ? "Exit" : "Fullscreen"}
    </button>
  );
}
