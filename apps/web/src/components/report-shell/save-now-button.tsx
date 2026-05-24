"use client";

import { useEffect, useRef, useState } from "react";

import type { AutosaveSnapshot } from "../../hooks/use-lead-form-autosave";

const SAVED_REVERT_MS = 1500;

interface SaveNowButtonProps {
  autosave: AutosaveSnapshot;
}

/**
 * Visible "Save now" button for the Lead Form toolbar.
 *
 * State machine:
 *   "Save now"  — default; enabled when autosave.state ∈ {pending, error}
 *   "⟳ Saving…" — while mutation is in flight (disabled)
 *   "✓ Saved"   — ~1500 ms after success, then reverts to "Save now"
 *   disabled    — when state ∈ {idle, saving, saved}
 */
export function SaveNowButton({ autosave }: SaveNowButtonProps) {
  const { state, isInFlight, forceSave } = autosave;

  // Local display state drives the "✓ Saved" flash separately from hook state.
  const [showSaved, setShowSaved] = useState(false);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When the hook reaches "saved" and we are not in a re-entrancy situation
  // (not in-flight), flash the checkmark for SAVED_REVERT_MS.
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

  // Clear timer on unmount.
  useEffect(() => {
    return () => {
      if (revertTimerRef.current !== null) {
        clearTimeout(revertTimerRef.current);
      }
    };
  }, []);

  const isSaving = isInFlight;
  const isEnabled = (state === "pending" || state === "error") && !isSaving;

  let label: string;
  let ariaLabel: string;

  if (isSaving) {
    label = "Saving…";
    ariaLabel = "Saving draft";
  } else if (showSaved) {
    label = "Saved";
    ariaLabel = "Draft saved";
  } else if (state === "error") {
    label = "Retry save";
    ariaLabel = "Retry saving draft";
  } else {
    label = "Save now";
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
      className="inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-3 py-1 font-[family-name:var(--font-sans)] text-xs font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isSaving ? (
        <>
          <SpinnerIcon />
          {label}
        </>
      ) : showSaved ? (
        <>
          <CheckIcon />
          <span className="text-[var(--color-success,#16a34a)]">{label}</span>
        </>
      ) : (
        label
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Internal icons
// ---------------------------------------------------------------------------

function SpinnerIcon() {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
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
      aria-hidden="true"
      width="12"
      height="12"
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
