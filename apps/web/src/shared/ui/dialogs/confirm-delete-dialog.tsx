"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@customreport/ui/components/ui/dialog";
import { type RefObject, useId, useRef } from "react";

import { usePortalTarget } from "./document-body-portal";

interface ConfirmDeleteDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly preview: string;
  readonly subtitle?: string | undefined;
  readonly consequence?: string | undefined;
  readonly confirmLabel?: string | undefined;
  readonly reversible?: boolean | undefined;
  readonly tone?: "destructive" | "primary" | undefined;
  readonly isPending?: boolean | undefined;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly triggerRef?: RefObject<HTMLElement | null> | undefined;
}

// Initial focus lands on Cancel (least-destructive action) so a reflexive Enter
// never deletes. Portal escapes overflow:hidden ancestors.
export function ConfirmDeleteDialog({
  open,
  isPending = false,
  onConfirm,
  onCancel,
  ...contentProps
}: ConfirmDeleteDialogProps) {
  const guardedCancel = isPending ? () => undefined : onCancel;
  const guardedConfirm = isPending ? () => undefined : onConfirm;
  const portalTarget = usePortalTarget();

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) guardedCancel();
      }}
    >
      <ConfirmDeleteContent
        {...contentProps}
        portalContainer={portalTarget}
        isPending={isPending}
        onConfirm={guardedConfirm}
        onCancel={guardedCancel}
      />
    </Dialog>
  );
}

interface ConfirmDeleteContentProps extends Omit<
  ConfirmDeleteDialogProps,
  "open" | "onConfirm" | "onCancel"
> {
  readonly isPending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly portalContainer?: HTMLElement | null | undefined;
}

function ConfirmDeleteContent({
  portalContainer,
  title,
  preview,
  subtitle,
  consequence,
  confirmLabel = "Delete",
  reversible = false,
  tone = "destructive",
  isPending,
  onConfirm,
  onCancel,
  triggerRef,
}: ConfirmDeleteContentProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const previewId = useId();
  const preventWhilePending = (event: Event) => {
    if (isPending) event.preventDefault();
  };

  return (
    <DialogContent
      portalContainer={portalContainer}
      showCloseButton={false}
      className="animate-scale-in z-[var(--layer-dialog)] block w-full max-w-[calc(100%-2rem)] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl sm:max-w-md"
      overlayClassName="z-[var(--layer-dialog)] bg-[var(--color-overlay)]"
      initialFocusRef={isPending ? undefined : cancelRef}
      restoreFocusRef={triggerRef}
      restoreFocusToPrevious={true}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={previewId}
      onEscapeKeyDown={preventWhilePending}
      onInteractOutside={preventWhilePending}
    >
      <ConfirmDeleteBody
        title={title}
        preview={preview}
        subtitle={subtitle}
        consequence={consequence}
        reversible={reversible}
        titleId={titleId}
        previewId={previewId}
      />
      <ConfirmDeleteActions
        cancelRef={cancelRef}
        confirmLabel={confirmLabel}
        tone={tone}
        isPending={isPending}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </DialogContent>
  );
}

type ConfirmDeleteBodyProps = Pick<
  ConfirmDeleteDialogProps,
  "title" | "preview" | "subtitle" | "consequence"
> & { readonly reversible: boolean };

function ConfirmDeleteBody({
  title,
  preview,
  subtitle,
  consequence,
  reversible,
  titleId,
  previewId,
}: ConfirmDeleteBodyProps & {
  readonly titleId: string;
  readonly previewId: string;
}) {
  return (
    <>
      <DialogTitle asChild>
        <h3
          id={titleId}
          className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]"
        >
          {title}
        </h3>
      </DialogTitle>

      <DialogDescription asChild>
        <p
          id={previewId}
          className="mt-3 line-clamp-2 break-words rounded-md border border-[var(--color-muted)] bg-[var(--color-surface-hover)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)]"
          title={preview}
        >
          {preview}
        </p>
      </DialogDescription>

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

      <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
        {reversible
          ? "This can be reversed later."
          : "This action cannot be undone."}
      </p>
    </>
  );
}

const ACTION_BUTTON_CLASS =
  "btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[36px] items-center justify-center rounded-[var(--radius-pill)] px-4 text-sm font-semibold";
const CANCEL_BUTTON_CLASS = `${ACTION_BUTTON_CLASS} border border-[var(--color-muted)] bg-transparent text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]`;
const CONFIRM_BUTTON_CLASS = `${ACTION_BUTTON_CLASS} border transition-[filter] hover:brightness-90`;
const CONFIRM_PRIMARY_CLASS = `${CONFIRM_BUTTON_CLASS} border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] text-[var(--color-primary-foreground)]`;
const CONFIRM_DESTRUCTIVE_CLASS = `${CONFIRM_BUTTON_CLASS} border-[var(--color-destructive)] bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)]`;

interface ConfirmDeleteActionsProps {
  readonly cancelRef: RefObject<HTMLButtonElement | null>;
  readonly confirmLabel: string;
  readonly tone: "destructive" | "primary";
  readonly isPending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function ConfirmDeleteActions({
  cancelRef,
  confirmLabel,
  tone,
  isPending,
  onConfirm,
  onCancel,
}: ConfirmDeleteActionsProps) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button
        ref={cancelRef}
        type="button"
        className={CANCEL_BUTTON_CLASS}
        onClick={onCancel}
        disabled={isPending}
      >
        Cancel
      </button>
      <button
        type="button"
        className={
          tone === "primary" ? CONFIRM_PRIMARY_CLASS : CONFIRM_DESTRUCTIVE_CLASS
        }
        onClick={onConfirm}
        disabled={isPending}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
