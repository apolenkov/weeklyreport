"use client";

import { type RefObject, useRef } from "react";
import { createPortal } from "react-dom";

import { useDialogFocus } from "../../lib/use-dialog-focus";

type ConfirmationDialogVariant = "default" | "destructive";

interface ConfirmationDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly title: string;
  readonly description: React.ReactNode;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly variant?: ConfirmationDialogVariant;
  readonly isPending?: boolean;
  readonly testId?: string;
  readonly children?: React.ReactNode;
}

function DialogActions({
  onClose,
  onConfirm,
  confirmLabel,
  cancelLabel,
  isDestructive,
  isPending,
}: {
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly isDestructive: boolean;
  readonly isPending: boolean;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={isPending}
        className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-muted)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
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
  );
}

type DialogSurfaceProps = Omit<
  ConfirmationDialogProps,
  "open" | "testId" | "variant"
> & {
  readonly dialogRef: RefObject<HTMLDivElement | null>;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly isDestructive: boolean;
  readonly isPending: boolean;
};

function DialogSurface({
  dialogRef,
  title,
  description,
  children,
  ...actions
}: DialogSurfaceProps) {
  return (
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

      <DialogActions {...actions} />
    </div>
  );
}

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
      <DialogSurface
        dialogRef={dialogRef}
        title={title}
        description={description}
        onClose={onClose}
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        isDestructive={variant === "destructive"}
        isPending={isPending}
      >
        {children}
      </DialogSurface>
    </div>,
    document.body,
  );
}
