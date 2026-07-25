"use client";

import { type RefObject, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useDialogFocus } from "../../lib/use-dialog-focus";

interface ConfirmDeleteDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly preview: string;
  readonly subtitle?: string;
  readonly consequence?: string;
  readonly confirmLabel?: string;
  readonly reversible?: boolean;
  readonly tone?: "destructive" | "primary";
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly triggerRef?: RefObject<HTMLElement | null>;
}

// Initial focus lands on Cancel (least-destructive action) so a reflexive Enter
// never deletes. Portal escapes overflow:hidden ancestors.
export function ConfirmDeleteDialog({
  open,
  title,
  preview,
  subtitle,
  consequence,
  confirmLabel = "Delete",
  reversible = false,
  tone = "destructive",
  onConfirm,
  onCancel,
  triggerRef,
}: ConfirmDeleteDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useDialogFocus({
    open,
    onClose: onCancel,
    containerRef: surfaceRef,
    triggerRef,
  });

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      // Confirm on Enter only while the destructive button holds focus —
      // otherwise the same key in the underlying form would confirm a
      // delete the user didn't mean.
      if (e.key === "Enter" && document.activeElement === confirmRef.current) {
        e.preventDefault();
        onConfirm();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onConfirm]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onCancel}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- onClick only stops backdrop-close propagation for inside clicks; no keyboard equivalent needed */}
      <div
        ref={surfaceRef}
        className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl"
        role="alertdialog"
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
            className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[36px] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-muted)] bg-transparent px-4 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[36px] items-center justify-center rounded-[var(--radius-pill)] border px-4 text-sm font-semibold transition-[filter] hover:brightness-90 ${
              tone === "primary"
                ? "border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] text-white"
                : "border-[var(--color-destructive)] bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)]"
            }`}
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
