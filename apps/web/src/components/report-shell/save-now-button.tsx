"use client";

import { useEffect, useRef, useState } from "react";

import type { AutosaveSnapshot } from "../../hooks/use-lead-form-autosave";

const SAVED_REVERT_MS = 1500;

interface SaveNowButtonProps {
  autosave: AutosaveSnapshot;
}

/**
 * Icon-only "Save now" button. Square sized to var(--touch-target-min)
 * (~44×44 for WCAG AA + parity with sibling toolbar controls); the SVG glyph
 * itself is 14×14, centred. Anchored to the toolbar's far-right slot.
 * Renders a floppy-disc icon by default; swaps to a spinner while a save is
 * in flight; flashes a check on success; shows an alert triangle on error.
 *
 * State → icon mapping:
 *   idle / pending          → disc        (enabled only in `pending`)
 *   saving (isInFlight)     → spinner    (disabled)
 *   saved (post-success)    → check      (disabled, reverts after 1500ms)
 *   error                   → alert      (enabled — click retries)
 */
export function SaveNowButton({ autosave }: SaveNowButtonProps) {
  const { state, isInFlight, forceSave } = autosave;

  const [showSaved, setShowSaved] = useState(false);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state === "saved" && !isInFlight) {
      setShowSaved(true);
      if (revertTimerRef.current !== null) {
        clearTimeout(revertTimerRef.current);
      }
      revertTimerRef.current = setTimeout(() => {
        setShowSaved(false);
        revertTimerRef.current = null;
      }, SAVED_REVERT_MS);
    }
  }, [state, isInFlight]);

  useEffect(() => {
    return () => {
      if (revertTimerRef.current !== null) {
        clearTimeout(revertTimerRef.current);
      }
    };
  }, []);

  const isSaving = isInFlight;
  const isEnabled = (state === "pending" || state === "error") && !isSaving;

  let ariaLabel: string;
  if (isSaving) {
    ariaLabel = "Saving draft";
  } else if (showSaved) {
    ariaLabel = "Draft saved";
  } else if (state === "error") {
    ariaLabel = "Retry saving draft";
  } else {
    ariaLabel = "Save draft now";
  }

  function handleClick() {
    if (!isEnabled) return;
    void forceSave();
  }

  return (
    <button
      type="button"
      disabled={!isEnabled}
      onClick={handleClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isSaving ? (
        <SpinnerIcon />
      ) : showSaved ? (
        <CheckIcon />
      ) : state === "error" ? (
        <AlertIcon />
      ) : (
        <DiscIcon />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Internal icons
// ---------------------------------------------------------------------------

function DiscIcon() {
  return (
    <svg
      data-testid="save-now-disc"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      data-testid="save-now-spinner"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 12 12"
      fill="none"
      style={{ animation: "saveBtnSpin 1s linear infinite" }}
    >
      <style>{`@keyframes saveBtnSpin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="6"
        cy="6"
        r="5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="20 11"
        opacity="0.9"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      data-testid="save-now-check"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 12 12"
      fill="none"
      stroke="var(--color-success,#16a34a)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="2 6 5 9 10 3" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      data-testid="save-now-alert"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
