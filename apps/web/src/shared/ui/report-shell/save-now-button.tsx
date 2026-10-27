"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useReducer,
  useRef,
} from "react";

import { CheckIcon as SharedCheckIcon } from "../icons/action-icons";

const SAVED_REVERT_MS = 1500;

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

export interface SaveNowButtonState {
  readonly state: SaveState;
  readonly isInFlight: boolean;
  readonly forceSave: () => Promise<void>;
}

interface SaveNowButtonProps {
  autosave: SaveNowButtonState;
  readonly retryOnly?: boolean;
  readonly onFocusedRetryHidden?: () => void;
}

// In-flight presentation takes precedence, followed by the saved flash, error,
// and the idle/pending Save presentation.
function deriveSaveView(
  state: SaveState,
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

// NOT green: brand green stays the single forward-commit (Submit). The busy
// state is report-toolbar-layout's one exemption to that single-primary rule.
const SAVING_CLASS_NAME =
  "border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] text-[var(--color-primary-foreground)] disabled:opacity-100";
const REST_CLASS_NAME =
  "border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-40";

// Post-success flash: true for SAVED_REVERT_MS after a save lands, and dropped
// the moment autosave leaves "saved" (new edit → pending, failed save → error)
// rather than waiting out the timer, which would strand a stale green check.
function useSavedFlash(
  state: SaveState,
  isInFlight: boolean,
  onFlashEnd?: () => void,
): boolean {
  const [showSaved, setShowSaved] = useReducer(
    (_current: boolean, next: boolean) => next,
    false,
  );
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state === "saved" && !isInFlight) {
      setShowSaved(true);
      if (revertTimerRef.current !== null) {
        clearTimeout(revertTimerRef.current);
      }
      revertTimerRef.current = setTimeout(() => {
        onFlashEnd?.();
        setShowSaved(false);
        revertTimerRef.current = null;
      }, SAVED_REVERT_MS);
    } else if (state !== "saved") {
      setShowSaved(false);
      if (revertTimerRef.current !== null) {
        clearTimeout(revertTimerRef.current);
        revertTimerRef.current = null;
      }
    }
  }, [state, isInFlight, onFlashEnd]);

  useEffect(() => {
    return () => {
      if (revertTimerRef.current !== null) {
        clearTimeout(revertTimerRef.current);
      }
    };
  }, []);

  return showSaved;
}

export function SaveNowButton({
  autosave,
  retryOnly = false,
  onFocusedRetryHidden,
}: SaveNowButtonProps) {
  const { state, isInFlight, forceSave } = autosave;
  const [retryActive, setRetryActive] = useReducer(
    (_current: boolean, next: boolean) => next,
    state === "error",
  );
  const endRetry = useCallback(() => setRetryActive(false), []);
  const showSaved = useSavedFlash(state, isInFlight, endRetry);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const setButtonRef = useCallback(
    (button: HTMLButtonElement | null) => {
      // Ref detachment runs before removal, while the focused node still exists.
      if (
        button === null &&
        buttonRef.current !== null &&
        buttonRef.current === document.activeElement
      ) {
        onFocusedRetryHidden?.();
      }
      buttonRef.current = button;
    },
    [onFocusedRetryHidden],
  );

  if (state === "error" && !retryActive) {
    setRetryActive(true);
  } else if (
    retryActive &&
    state !== "error" &&
    state !== "saved" &&
    !isInFlight
  ) {
    setRetryActive(false);
  }

  const isSaving = isInFlight;
  const isEnabled = (state === "pending" || state === "error") && !isSaving;

  function handleClick() {
    if (!isEnabled) return;
    void forceSave();
  }

  const { ariaLabel, label, icon } = deriveSaveView(state, isSaving, showSaved);

  if (retryOnly && state !== "error" && !retryActive) return null;

  return (
    <button
      ref={setButtonRef}
      type="button"
      disabled={!isEnabled}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-busy={isSaving}
      className={`btn-press inline-flex h-[var(--toolbar-control-h)] min-w-[6.5rem] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border px-4 font-[family-name:var(--font-sans)] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed ${
        isSaving ? SAVING_CLASS_NAME : REST_CLASS_NAME
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

// The reduced-motion variant must own the rotation: an inline animation style
// would beat the stylesheet rule that stops it.
function SpinnerIcon() {
  return (
    <svg
      data-testid="save-now-spinner"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 12 12"
      fill="none"
      className="animate-spin motion-reduce:animate-none"
    >
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
    <span data-testid="save-now-check" className="inline-flex">
      <SharedCheckIcon className="h-[14px] w-[14px] text-[var(--color-success-foreground)]" />
    </span>
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
