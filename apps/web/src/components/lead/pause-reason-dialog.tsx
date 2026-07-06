"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface PauseReasonDialogProps {
  readonly open: boolean;
  /** Single-line preview of the item being paused. */
  readonly preview: string;
  /** Pre-fill when re-pausing an already-paused item (edit its reason). */
  readonly initialReason?: string;
  readonly onConfirm: (reason: string) => void;
  readonly onCancel: () => void;
}

/**
 * require-paused-item-reason: the reason prompt shown when a lead pauses an
 * item from its card. A pause is never silent — the reason is required, so the
 * confirm button stays disabled until the field is non-empty. Mirrors
 * `ConfirmDeleteDialog`'s modal/focus/escape shape; portaled to body to escape
 * any `overflow:hidden` ancestor.
 */
export function PauseReasonDialog({
  open,
  preview,
  initialReason = "",
  onConfirm,
  onCancel,
}: PauseReasonDialogProps) {
  const [reason, setReason] = useState(initialReason);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset the field each time the dialog opens so a prior draft never leaks
  // into the next pause.
  useEffect(() => {
    if (!open) return;
    setReason(initialReason);
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, initialReason]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const trimmed = reason.trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops backdrop-close propagation for inside clicks; no keyboard equivalent needed */}
      <div
        className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-reason-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="pause-reason-title"
          className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]"
        >
          Pause this item?
        </h3>

        <p
          className="mt-3 line-clamp-2 break-words rounded-md border border-[var(--color-muted)] bg-[var(--color-surface-hover)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)]"
          title={preview}
        >
          {preview}
        </p>

        <label
          className="mt-4 mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          htmlFor="pause-reason-input"
        >
          Reason *
        </label>
        <textarea
          id="pause-reason-input"
          ref={textareaRef}
          className="w-full resize-y rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
          style={{ minHeight: "64px" }}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this paused? (e.g. waiting on a dependency)"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[36px] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-muted)] bg-transparent px-4 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={trimmed.length === 0}
            className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[36px] items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => onConfirm(trimmed)}
          >
            Pause
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
