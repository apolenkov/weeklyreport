"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type RequestReopenDialogProps = {
  readonly open: boolean;
  /**
   * Whether the mutation is currently in flight. Drives the disabled
   * state on the destructive button so a double-click doesn't queue
   * two reopen requests for the same section.
   */
  readonly pending?: boolean;
  /**
   * Caller-side error to surface inside the dialog when the mutation
   * fails. Kept as a generic string so the caller can inline whatever
   * its tRPC layer returns without coupling shapes.
   */
  readonly error?: string | null;
  /**
   * Called with the reason (trimmed). The reason is optional per the
   * API contract — empty/whitespace-only resolves to undefined so the
   * server doesn't store a blank string.
   */
  readonly onConfirm: (reason: string | undefined) => void;
  readonly onCancel: () => void;
};

/**
 * Lead-side modal for asking Head to reopen a submitted section.
 *
 * Submitted sections are read-only by default — the Lead can't simply
 * un-submit them (only Head can revoke). This is the polite path: the
 * Lead writes a one-line reason and the request goes to Head.
 *
 * Backend: leadForm.requestReopen mutation already exists from Phase
 * 21-04 (`apps/api/src/modules/report-sections/lead-form.service.ts`).
 */
export function RequestReopenDialog({
  open,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: RequestReopenDialogProps) {
  const [reason, setReason] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    // Defer focus so the portal mounts first.
    const id = requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  function handleConfirm() {
    const trimmed = reason.trim();
    onConfirm(trimmed.length > 0 ? trimmed : undefined);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleConfirm();
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Request Reopen dialog"
      >
        <h2 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          Request Reopen
        </h2>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Ask Head to unlock this section. A short note about what you need to
          change makes it easier to approve quickly.
        </p>

        <div className="mt-4">
          <label
            htmlFor="reopen-reason"
            className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
          >
            Reason{" "}
            <span className="font-normal text-[var(--color-muted-foreground)]">
              (optional, max 500 chars)
            </span>
          </label>
          <textarea
            id="reopen-reason"
            ref={textareaRef}
            className="w-full resize-y rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
            style={{ minHeight: "80px" }}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Forgot to add the carry-over from last week."
          />
          <div className="mt-1 text-right text-[11px] text-[var(--color-muted-foreground)]">
            {reason.length}/500
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs text-[var(--color-destructive)]">
            {error}
          </p>
        )}

        <p className="mt-3 text-[11px] text-[var(--color-muted-foreground)]">
          Once submitted, Head will see the request and either reopen the
          section or leave a note. You'll be notified by email.
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="btn-press inline-flex min-h-[40px] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)] disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send Request"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
