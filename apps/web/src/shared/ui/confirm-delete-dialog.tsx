"use client";

import { type ReactNode, type RefObject, useEffect, useRef } from "react";

import { useDialogFocus } from "../../lib/use-dialog-focus";
import { DialogSurface } from "./dialog-surface";
import { DocumentBodyPortal } from "./document-body-portal";

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
  title,
  preview,
  subtitle,
  consequence,
  confirmLabel = "Delete",
  reversible = false,
  tone = "destructive",
  isPending = false,
  onConfirm,
  onCancel,
  triggerRef,
}: ConfirmDeleteDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // While the destructive action is in flight the dialog stays put: no Enter
  // re-submit, no Escape/backdrop dismissal — the action cannot be abandoned
  // or double-fired mid-flight.
  const guardedCancel = isPending ? () => undefined : onCancel;
  const guardedConfirm = isPending ? () => undefined : onConfirm;

  useDialogFocus({
    open,
    onClose: guardedCancel,
    containerRef: surfaceRef,
    triggerRef,
  });
  useConfirmOnEnter(open, guardedConfirm, confirmRef);

  if (!open) return null;

  return (
    <DocumentBodyPortal>
      <ConfirmDialogShell surfaceRef={surfaceRef} onDismiss={guardedCancel}>
        <ConfirmDeleteBody
          title={title}
          preview={preview}
          subtitle={subtitle}
          consequence={consequence}
          reversible={reversible}
        />
        <ConfirmDeleteActions
          confirmRef={confirmRef}
          confirmLabel={confirmLabel}
          tone={tone}
          isPending={isPending}
          onConfirm={guardedConfirm}
          onCancel={guardedCancel}
        />
      </ConfirmDialogShell>
    </DocumentBodyPortal>
  );
}

// Backdrop + centred surface. Clicking the backdrop dismisses; clicks inside
// the surface are stopped so they never reach it.
function ConfirmDialogShell({
  surfaceRef,
  onDismiss,
  children,
}: {
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
  readonly onDismiss: () => void;
  readonly children: ReactNode;
}) {
  return (
    <DialogSurface
      surfaceRef={surfaceRef}
      onDismiss={onDismiss}
      surfaceClassName="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl"
      role="alertdialog"
      ariaLabelledBy="confirm-delete-title"
      ariaDescribedBy="confirm-delete-preview"
    >
      {children}
    </DialogSurface>
  );
}

// Confirm on Enter only while the destructive button holds focus — otherwise
// the same key in the underlying form would confirm a delete the user didn't
// mean.
function useConfirmOnEnter(
  open: boolean,
  onConfirm: () => void,
  confirmRef: RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter" && document.activeElement === confirmRef.current) {
        e.preventDefault();
        onConfirm();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onConfirm, confirmRef]);
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
}: ConfirmDeleteBodyProps) {
  return (
    <>
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
  readonly confirmRef: RefObject<HTMLButtonElement | null>;
  readonly confirmLabel: string;
  readonly tone: "destructive" | "primary";
  readonly isPending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function ConfirmDeleteActions({
  confirmRef,
  confirmLabel,
  tone,
  isPending,
  onConfirm,
  onCancel,
}: ConfirmDeleteActionsProps) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button
        type="button"
        className={CANCEL_BUTTON_CLASS}
        onClick={onCancel}
        disabled={isPending}
      >
        Cancel
      </button>
      <button
        ref={confirmRef}
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
