"use client";

import { type Ref, useEffect, useState } from "react";

import { SlideFullscreenButton } from "./slide-fullscreen-button";

// Keep the transient fullscreen hint visible long enough to be noticed.
const ESC_HINT_MS = 3000;

// Must render inside the fullscreened element (else invisible); top-center
// avoids the floating exit control at top-right.
function SlideEscHint({ isFullscreen }: { readonly isFullscreen: boolean }) {
  const [autoHidden, setAutoHidden] = useState(false);
  const [prevFullscreen, setPrevFullscreen] = useState(isFullscreen);

  // Re-arm the hint each time fullscreen is entered; adjusting state during
  // render keeps the reset out of an effect (no cascading render).
  if (isFullscreen !== prevFullscreen) {
    setPrevFullscreen(isFullscreen);
    if (isFullscreen) setAutoHidden(false);
  }

  useEffect(() => {
    if (!isFullscreen || autoHidden) return;
    const timer = setTimeout(() => setAutoHidden(true), ESC_HINT_MS);
    return () => clearTimeout(timer);
  }, [isFullscreen, autoHidden]);

  if (!isFullscreen) return null;

  const show = !autoHidden;

  // Keep the live region mounted while the hint auto-hides so its text change
  // remains available to assistive technology.
  return (
    <div
      role="status"
      data-testid="slide-esc-hint"
      className={
        show
          ? "fixed left-1/2 top-4 z-[var(--layer-popover)] -translate-x-1/2 rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-4 py-1.5 text-sm font-medium text-[var(--color-foreground)] shadow-lg"
          : "sr-only"
      }
    >
      {show ? "Press Esc to exit fullscreen" : ""}
    </div>
  );
}

// Floating exit control + Esc hint; both must live inside the fullscreened element.
export function DeckFullscreenOverlay({
  isFullscreen,
  onToggle,
}: {
  readonly isFullscreen: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <>
      <SlideFullscreenButton
        isFullscreen={isFullscreen}
        onToggle={onToggle}
        variant="floating"
      />
      <SlideEscHint isFullscreen={isFullscreen} />
    </>
  );
}

// Shared toolbar cluster; toggleRef returns focus to this control on fullscreen exit.
export function DeckToolbarControls({
  isFullscreen,
  onToggle,
  toggleRef,
}: {
  readonly isFullscreen: boolean;
  readonly onToggle: () => void;
  readonly toggleRef: Ref<HTMLButtonElement>;
}) {
  return (
    <SlideFullscreenButton
      isFullscreen={isFullscreen}
      onToggle={onToggle}
      buttonRef={toggleRef}
    />
  );
}
