"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@weeklyreport/ui/components/ui/dialog";
import { type RefObject, useEffect, useRef } from "react";

import { usePortalTarget } from "./document-body-portal";
import { usePendingFocusPark } from "./use-pending-focus-park";

interface ConfirmDeleteDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly preview: string;
  readonly subtitle?: string | undefined;
  readonly consequence?: string | undefined;
  readonly confirmLabel?: string | undefined;
  readonly reversible?: boolean | undefined;
  // false drops the reversibility footnote when the client cannot know it.
  readonly showReversibility?: boolean | undefined;
  readonly tone?: "destructive" | "primary" | undefined;
  readonly isPending?: boolean | undefined;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly triggerRef?: RefObject<HTMLElement | null> | undefined;
  // Used on close only when the trigger and the previously focused element are
  // both gone (C5246); a stable container keeps focus off <body>.
  readonly restoreFocusFallbackRef?: RefObject<HTMLElement | null> | undefined;
}

// Initial focus lands on Cancel (least-destructive action) so a reflexive Enter
// never deletes. Portal escapes overflow:hidden ancestors.
export function ConfirmDeleteDialog({
  open,
  isPending,
  onConfirm,
  onCancel,
  ...contentProps
}: ConfirmDeleteDialogProps) {
  const pending = isPending === true;
  // C5240: a host that reports isPending runs the pending protocol, so the first
  // confirm is spent; a host that leaves it out keeps confirming every time.
  const confirmIsOneShot = isPending !== undefined;
  const confirmSpent = useRef(false);
  useEffect(() => {
    // A new pending phase or a reopened dialog re-arms the confirm.
    if (pending || !open) confirmSpent.current = false;
  }, [open, pending]);
  const guardedCancel = pending ? () => undefined : onCancel;
  const guardedConfirm = () => {
    if (pending || (confirmIsOneShot && confirmSpent.current)) return;
    confirmSpent.current = true;
    onConfirm();
  };
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
        isPending={pending}
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
  showReversibility = true,
  tone = "destructive",
  isPending,
  onConfirm,
  onCancel,
  triggerRef,
  restoreFocusFallbackRef,
}: ConfirmDeleteContentProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = usePendingFocusPark(isPending);
  const preventWhilePending = (event: Event) => {
    if (isPending) event.preventDefault();
  };

  return (
    <DialogContent
      ref={panelRef}
      portalContainer={portalContainer}
      showCloseButton={false}
      className="animate-scale-in z-[var(--layer-dialog)] block w-full max-w-[calc(100%-2rem)] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl sm:max-w-md"
      overlayClassName="z-[var(--layer-dialog)] bg-[var(--color-overlay)]"
      initialFocusRef={isPending ? undefined : cancelRef}
      restoreFocusRef={triggerRef}
      restoreFocusToPrevious={true}
      restoreFocusFallbackRef={restoreFocusFallbackRef}
      role="alertdialog"
      aria-modal="true"
      onEscapeKeyDown={preventWhilePending}
      onInteractOutside={preventWhilePending}
    >
      <ConfirmDeleteBody
        title={title}
        preview={preview}
        subtitle={subtitle}
        consequence={consequence}
        reversible={reversible}
        showReversibility={showReversibility}
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
> & { readonly reversible: boolean; readonly showReversibility: boolean };

function ConfirmDeleteBody({
  title,
  preview,
  subtitle,
  consequence,
  reversible,
  showReversibility,
}: ConfirmDeleteBodyProps) {
  return (
    <>
      <DialogTitle asChild>
        <h3 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          {title}
        </h3>
      </DialogTitle>

      {/* C5243: every shown risk context belongs to the description, so the
          dialog does not announce a preview that hides the consequence. */}
      <DialogDescription asChild>
        <div>
          <p
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

          {showReversibility ? (
            <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
              {reversible
                ? "This can be reversed later."
                : "This action cannot be undone."}
            </p>
          ) : null}
        </div>
      </DialogDescription>
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
