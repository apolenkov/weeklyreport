"use client";

import { type Ref, useEffect, useState } from "react";

import { AgentReviewComingSoon } from "../report-shell/agent-review-coming-soon";
import { SlideFullscreenButton } from "./slide-fullscreen-button";

/** How long the transient "Press Esc to exit" hint stays on entering fullscreen. */
const ESC_HINT_MS = 3000;

/**
 * Transient "Press Esc to exit" hint, shown ~3s on entering fullscreen then
 * auto-dismissed. It MUST render inside the fullscreened element (else it is
 * invisible in fullscreen) and is positioned top-center to avoid the floating
 * exit pill (top-right). Renders nothing outside fullscreen.
 */
function SlideEscHint({ isFullscreen }: { readonly isFullscreen: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isFullscreen) {
      setShow(false);
      return;
    }
    setShow(true);
    const timer = setTimeout(() => setShow(false), ESC_HINT_MS);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  if (!isFullscreen || !show) return null;

  return (
    <div
      role="status"
      data-testid="slide-esc-hint"
      className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-[var(--color-card)] px-4 py-1.5 text-sm font-medium text-[var(--color-foreground)] shadow-lg"
    >
      Press Esc to exit fullscreen
    </div>
  );
}

/**
 * add-slide-fullscreen-exit-affordance: the in-fullscreen overlay shared by
 * every slide deck — the persistent floating "Exit" pill plus the transient
 * Esc hint. Both must render INSIDE the fullscreened element; both self-gate on
 * `isFullscreen`. The deck-level `useFullscreen` owner supplies the state.
 */
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

/**
 * The standalone lead deck's toolbar control cluster: the Agent-review
 * coming-soon control + the persistent "Enter/Exit fullscreen" toggle. Shared
 * by both deck render branches (own/summary + product). `toggleRef` lets the
 * deck-level `useFullscreen` owner return focus to this toggle on exit.
 */
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
