"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@customreport/ui/components/ui/dialog";
import { useRef } from "react";

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
  cancelRef,
}: {
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly isDestructive: boolean;
  readonly isPending: boolean;
  readonly cancelRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button
        ref={cancelRef}
        type="button"
        onClick={onClose}
        disabled={isPending}
        className="btn-press inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-muted)] bg-transparent px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        data-interaction-effect="mutation-required"
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
  readonly cancelRef: React.RefObject<HTMLButtonElement | null>;
};

function ConfirmationBody({
  title,
  description,
  children,
  ...actions
}: ConfirmationBodyProps) {
  return (
    <>
      <DialogTitle asChild>
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {title}
        </h3>
      </DialogTitle>
      <DialogDescription asChild>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
      </DialogDescription>

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
  const cancelRef = useRef<HTMLButtonElement>(null);

  // While the action is in flight the dialog stays put: Escape and backdrop
  // dismissal are suppressed so the submit cannot be abandoned mid-flight.
  const guardedClose = isPending ? () => undefined : onClose;
  const guardedConfirm = isPending ? () => undefined : onConfirm;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) guardedClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="animate-scale-in z-[var(--layer-dialog)] block w-full max-w-[calc(100%-2rem)] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl sm:max-w-md"
        overlayClassName="z-[var(--layer-dialog)] bg-[var(--color-overlay)]"
        overlayTestId={testId}
        initialFocusRef={isPending ? undefined : cancelRef}
        restoreFocusToPrevious={true}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onEscapeKeyDown={(event) => {
          if (isPending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isPending) event.preventDefault();
        }}
      >
        <ConfirmationBody
          title={title}
          description={description}
          onClose={guardedClose}
          onConfirm={guardedConfirm}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          isDestructive={variant === "destructive"}
          isPending={isPending}
          cancelRef={cancelRef}
        >
          {children}
        </ConfirmationBody>
      </DialogContent>
    </Dialog>
  );
}
