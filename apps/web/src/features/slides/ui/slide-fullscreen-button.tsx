"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import type { Ref } from "react";

interface SlideFullscreenButtonProps {
  readonly isFullscreen: boolean;
  readonly onToggle: () => void;
  readonly variant?: "default" | "floating";
  /**
   * Captures the DOM node so the deck-level `useFullscreen` owner can return
   * focus to this persistent toggle when fullscreen ends (never the floating
   * pill, which unmounts).
   */
  readonly buttonRef?: Ref<HTMLButtonElement>;
}

/**
 * Presentational fullscreen toggle. The state — plus the `f` shortcut and the
 * native `fullscreenchange` subscription — is owned by a single deck-level
 * `useFullscreen` hook (add-slide-fullscreen-exit-affordance), so adding a
 * second visible exit control never double-toggles. The `floating` variant
 * self-gates: it renders nothing unless `isFullscreen`.
 */
export function SlideFullscreenButton({
  isFullscreen,
  onToggle,
  variant = "default",
  buttonRef,
}: SlideFullscreenButtonProps) {
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
      ref={buttonRef}
      type="button"
      onClick={onToggle}
      aria-pressed={isFullscreen}
      aria-label={label}
      title={label}
      className={className}
    >
      {isFullscreen ? (
        <Minimize2 className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Maximize2 className="h-4 w-4" aria-hidden="true" />
      )}
      {/* The self-gate above means a rendered floating variant is always
          fullscreen — the pill only ever needs to offer "Exit". */}
      {variant === "floating" && " Exit"}
    </button>
  );
}
