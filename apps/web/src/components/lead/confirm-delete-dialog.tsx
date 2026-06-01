"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmDeleteDialogProps {
  /** Open/close state — caller owns this. */
  readonly open: boolean;
  /**
   * Title shown at the top of the modal.
   * Example: "Delete item?", "Delete risk?"
   */
  readonly title: string;
  /**
   * Single-line preview of the row being deleted. Truncated by the
   * dialog itself to keep the layout stable for any input length.
   */
  readonly preview: string;
  /**
   * Optional secondary line under the preview, e.g. "from CRM Platform"
   * or "Owner: Lead 1" — shown muted below the bold preview.
   */
  readonly subtitle?: string;
  /**
   * Optional consequence note rendered above the action buttons. Use it
   * to surface non-obvious side effects ("This will also remove the
   * 2 linked items"). Keep to ~one short sentence.
   */
  readonly consequence?: string;
  /**
   * Label for the destructive button. Defaults to "Delete". Set to
   * "Archive", "Remove", "Discard" etc. when the verb fits the action
   * better. The button keeps the destructive red styling regardless.
   */
  readonly confirmLabel?: string;
  /**
   * When true, replaces the "This action cannot be undone." footer
   * with a softer "This can be reversed later." line. Use for archive
   * / soft-delete flows where the row is recoverable.
   */
  readonly reversible?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * shadcn-style destructive confirm dialog. Shared across every
 * delete surface on /lead/report (items, risks, decisions, priorities)
 * so the UX is identical and the parent sections only need to track
 * `pendingDelete` state, not the modal lifecycle.
 *
 * Keyboard: Escape cancels; Enter confirms (focus is set on the
 * destructive button on open). Click on the overlay also cancels.
 *
 * Rendered through a portal to document.body so it escapes any
 * `overflow:hidden` ancestor and always sits above the form.
 */
export function ConfirmDeleteDialog({
  open,
  title,
  preview,
  subtitle,
  consequence,
  confirmLabel = "Delete",
  reversible = false,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Focus the destructive button on open so Enter confirms and a
    // user with keyboard-only navigation can act immediately. Defer
    // one frame so the portal has mounted.
    const id = requestAnimationFrame(() => {
      confirmRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (
        e.key === "Enter" &&
        document.activeElement === confirmRef.current
      ) {
        // Only fire on Enter when the destructive button is focused —
        // otherwise the same key in the underlying form would also
        // confirm a delete the user didn't mean.
        e.preventDefault();
        onConfirm();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel, onConfirm]);

  if (!open || typeof document === "undefined") return null;

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
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-preview"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="confirm-delete-title"
          className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]"
        >
          {title}
        </h3>

        <p
          id="confirm-delete-preview"
          className="mt-3 line-clamp-2 break-words rounded-md border border-[var(--color-muted)] bg-[var(--color-surface-hover)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)]"
          title={preview}
        >
          {preview}
        </p>

        {subtitle && (
          <p className="mt-2 text-[12px] text-[var(--color-muted-foreground)]">
            {subtitle}
          </p>
        )}

        {consequence && (
          <p className="mt-3 text-[12px] text-[var(--color-destructive)]">
            {consequence}
          </p>
        )}

        <p className="mt-4 text-[11px] text-[var(--color-muted-foreground)]">
          {reversible
            ? "This can be reversed later."
            : "This action cannot be undone."}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="btn-press inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-muted)] bg-transparent px-4 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn-press inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-destructive)] bg-[var(--color-destructive)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#a02020]"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
