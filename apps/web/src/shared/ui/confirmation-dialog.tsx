"use client";

import { useId, useRef } from "react";

import { useDialogFocus } from "../../lib/use-dialog-focus";
import { DialogSurface } from "./dialog-surface";
import { DocumentBodyPortal } from "./document-body-portal";

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
        className={`btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          isDestructive
            ? "bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:bg-destructive/90"
            : "bg-[var(--color-starbucks-accent)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)]"
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

type ConfirmationBodyProps = Omit<
  ConfirmationDialogProps,
  "open" | "testId" | "variant"
> & {
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly isDestructive: boolean;
  readonly isPending: boolean;
};

function ConfirmationBody({
  title,
  description,
  descriptionId,
  children,
  ...actions
}: ConfirmationBodyProps & { readonly descriptionId: string }) {
  return (
    <>
      <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
        {title}
      </h3>
      <p
        id={descriptionId}
        className="mt-2 text-sm text-[var(--color-muted-foreground)]"
      >
        {description}
      </p>

      {children && <div className="mt-3">{children}</div>}

      <DialogActions {...actions} />
    </>
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
  const descriptionId = useId();

  // While the action is in flight the dialog stays put: Escape and backdrop
  // dismissal are suppressed so the submit cannot be abandoned mid-flight.
  const guardedClose = isPending ? () => undefined : onClose;
  const guardedConfirm = isPending ? () => undefined : onConfirm;

  useDialogFocus({ open, onClose: guardedClose, containerRef: dialogRef });

  if (!open) return null;

  return (
    <DocumentBodyPortal>
      <DialogSurface
        surfaceRef={dialogRef}
        onDismiss={guardedClose}
        surfaceClassName="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl"
        role="alertdialog"
        ariaLabel={title}
        ariaDescribedBy={descriptionId}
        testId={testId}
      >
        <ConfirmationBody
          title={title}
          description={description}
          descriptionId={descriptionId}
          onClose={guardedClose}
          onConfirm={guardedConfirm}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          isDestructive={variant === "destructive"}
          isPending={isPending}
        >
          {children}
        </ConfirmationBody>
      </DialogSurface>
    </DocumentBodyPortal>
  );
}
