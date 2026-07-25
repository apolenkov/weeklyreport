"use client";

import { type Ref, useEffect, useState } from "react";

import { AgentReviewComingSoon } from "../../../shared/ui/report-shell/agent-review-coming-soon";
import { SlideFullscreenButton } from "./slide-fullscreen-button";

/** How long the transient "Press Esc to exit" hint stays on entering fullscreen. */
const ESC_HINT_MS = 3000;

// Must render inside the fullscreened element (else invisible); top-center
// avoids the floating exit pill at top-right.
function SlideEscHint({ isFullscreen }: { readonly isFullscreen: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isFullscreen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show-then-auto-hide timer choreography on entering fullscreen; the timeout owns the state transitions
      setShow(false);
      return;
    }
    setShow(true);
    const timer = setTimeout(() => setShow(false), ESC_HINT_MS);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  if (!isFullscreen) return null;

  // Keep the live region mounted while fullscreen and toggle only its text —
  // some screen readers miss a region that mounts already populated.
  return (
    <div
      role="status"
      data-testid="slide-esc-hint"
      className={
        show
          ? "fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-[var(--color-card)] px-4 py-1.5 text-sm font-medium text-[var(--color-foreground)] shadow-lg"
          : "sr-only"
      }
    >
      {show ? "Press Esc to exit fullscreen" : ""}
    </div>
  );
}

// Floating exit pill + Esc hint; both must live inside the fullscreened element.
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
    <>
      <AgentReviewComingSoon />
      <SlideFullscreenButton
        isFullscreen={isFullscreen}
        onToggle={onToggle}
        buttonRef={toggleRef}
      />
    </>
  );
}
