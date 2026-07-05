"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

import type { AutosaveSnapshot } from "../../hooks/use-lead-form-autosave";

const SAVED_REVERT_MS = 1500;

interface SaveNowButtonProps {
  autosave: AutosaveSnapshot;
}

/** State → { accessible label, visible label, icon }. Kept out of the component
 *  so its branching does not inflate the component's cognitive complexity. */
function deriveSaveView(
  state: AutosaveSnapshot["state"],
  isSaving: boolean,
  showSaved: boolean,
): { ariaLabel: string; label: string; icon: ReactNode } {
  if (isSaving)
    return {
      ariaLabel: "Saving draft",
      label: "Saving",
      icon: <SpinnerIcon />,
    };
  if (showSaved)
    return { ariaLabel: "Draft saved", label: "Saved", icon: <CheckIcon /> };
  if (state === "error")
    return {
      ariaLabel: "Retry saving draft",
      label: "Retry",
      icon: <AlertIcon />,
    };
  return { ariaLabel: "Save draft now", label: "Save", icon: <DiscIcon /> };
}

/**
 * Icon-only "Save now" button. Circle 32×32 to match the pill-shaped
 * sibling controls in the toolbar (period nav arrows, version nav arrows,
 * Fill caret); the SVG glyph itself is 14×14, centred. Anchored to the
 * toolbar's far-right slot. Renders a floppy-disc icon by default; swaps
 * to a spinner while a save is in flight; flashes a check on success;
 * shows an alert triangle on error.
 *
 * State → icon mapping:
 *   idle / pending          → disc        (enabled only in `pending`)
 *   saving (isInFlight)     → spinner    (disabled, accent green fill,
 *                                         white icon, aria-busy="true",
 *                                         full opacity overrides washout)
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

  function handleClick() {
    if (!isEnabled) return;
    void forceSave();
  }

  // Labeled neutral pill at the shared toolbar height — visible "Save" text,
  // sized like the other labeled actions but NOT green: brand green stays the
  // single forward-commit (Submit). The transient saving state keeps
  // the accent busy treatment (report-toolbar-layout: Save busy accent is the
  // one exemption to the single-primary rule).
  const savingClassName =
    "border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] text-white disabled:opacity-100";
  const restClassName =
    "border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40";

  const { ariaLabel, label, icon } = deriveSaveView(state, isSaving, showSaved);

  return (
    <button
      type="button"
      disabled={!isEnabled}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-busy={isSaving}
      className={`btn-press inline-flex h-[var(--toolbar-control-h)] min-w-[6.5rem] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border px-4 font-[family-name:var(--font-sans)] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed ${
        isSaving ? savingClassName : restClassName
      }`}
    >
      {icon}
      <span>{label}</span>
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
      stroke="var(--color-success-foreground)"
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
