"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect } from "react";

import { useIsFullscreen } from "../../hooks/use-is-fullscreen";

interface SlideFullscreenButtonProps {
  readonly targetRef: React.RefObject<HTMLElement | null>;
  readonly variant?: "default" | "floating";
}

export function SlideFullscreenButton({
  targetRef,
  variant = "default",
}: SlideFullscreenButtonProps) {
  const isFullscreen = useIsFullscreen();

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
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "f" || e.key === "F") toggle();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [toggle]);

  if (variant === "floating" && !isFullscreen) return null;

  // Floating overlay keeps its labeled pill; the in-toolbar default is an
  // icon-only square at the shared toolbar height so it matches the other
  // controls (the label survives as aria-label + tooltip).
  const className =
    variant === "floating"
      ? "btn-press fixed top-4 right-4 z-50 inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-[var(--color-card)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] shadow-lg transition-colors hover:bg-[var(--color-surface-hover)]"
      : "btn-press inline-flex h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)]";

  const label = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={className}
    >
      {isFullscreen ? (
        <Minimize2 className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Maximize2 className="h-4 w-4" aria-hidden="true" />
      )}
      {variant === "floating" && (isFullscreen ? " Exit" : " Fullscreen")}
    </button>
  );
}
