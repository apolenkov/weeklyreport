"use client";

import { useRef } from "react";
import { createPortal } from "react-dom";

import { useDialogFocus } from "../../lib/use-dialog-focus";

type ConfirmationDialogVariant = "default" | "destructive";

interface ConfirmationDialogProps {
  /** Whether the dialog is visible */
  readonly open: boolean;
  /** Called when dialog is dismissed or cancelled */
  readonly onClose: () => void;
  /** Called when user confirms the action */
  readonly onConfirm: () => void;
  /** Dialog title */
  readonly title: string;
  /** Dialog description / body text */
  readonly description: React.ReactNode;
  /** Label for the confirm button (defaults to "Confirm") */
  readonly confirmLabel?: string;
  /** Label for the cancel button (defaults to "Cancel") */
  readonly cancelLabel?: string;
  /** Visual variant — destructive shows red confirm button */
  readonly variant?: ConfirmationDialogVariant;
  /** Disable both actions while the confirm operation is pending. */
  readonly isPending?: boolean;
  /** Optional stable selector for an integration flow's backdrop. */
  readonly testId?: string;
  /** Optional extra content between description and buttons */
  readonly children?: React.ReactNode;
}

/**
 * Reusable confirmation dialog for confirmation actions.
 * - Traps focus inside the dialog and restores it to the trigger on close
 *   (via the shared `useDialogFocus` primitive)
 * - Closes on Escape
 * - Closes on backdrop click
 * - Supports destructive (red) and standard (green) confirm buttons
 */
export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isPending = false,
  testId,
  children,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const isDestructive = variant === "destructive";

  useDialogFocus({ open, onClose, containerRef: dialogRef });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
      data-testid={testId}
    >
      <div
        ref={dialogRef}
        className="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {title}
        </h3>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>

        {children && <div className="mt-3">{children}</div>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isDestructive
                ? "bg-[var(--color-destructive)] hover:bg-red-700"
                : "bg-[var(--color-starbucks-accent)] hover:bg-[var(--color-primary)]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
