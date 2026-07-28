"use client";

import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { useDialogFocus } from "../../../lib/use-dialog-focus";
import { DialogSurface } from "../../../shared/ui/dialog-surface";

// Matches the leadForm.requestReopen API max (local copy — do not import from api).
const MAX_REOPEN_REASON_LENGTH = 500;

interface RequestReopenDialogProps {
  readonly open: boolean;
  readonly pending?: boolean;
  readonly error?: string | null;
  readonly onConfirm: (reason: string | undefined) => void;
  readonly onCancel: () => void;
}

// Lead-side modal to ask Head to reopen a submitted (read-only) section.
export function RequestReopenDialog({
  open,
  ...contentProps
}: RequestReopenDialogProps) {
  // The form mounts fresh on every open, so `reason` starts empty on mount —
  // no reset effect.
  if (!open || typeof document === "undefined") return null;
  return <RequestReopenDialogContent {...contentProps} />;
}

function RequestReopenDialogContent({
  pending = false,
  error,
  onConfirm,
  onCancel,
}: Omit<RequestReopenDialogProps, "open">) {
  const [reason, setReason] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dialogSurfaceRef = useRef<HTMLDivElement>(null);

  // Escape + focus trap + restore-to-trigger via the shared primitive. The
  // content component exists only while open.
  useDialogFocus({
    open: true,
    onClose: onCancel,
    containerRef: dialogSurfaceRef,
  });
  useFocusOnMount(textareaRef);

  function handleConfirm() {
    const trimmed = reason.trim();
    onConfirm(trimmed.length > 0 ? trimmed : undefined);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleConfirm();
    }
  }

  return createPortal(
    <ReopenDialogShell
      surfaceRef={dialogSurfaceRef}
      onDismiss={onCancel}
      onKeyDown={handleKeyDown}
    >
      <ReopenDialogHeader />
      <ReopenReasonField
        reason={reason}
        onReasonChange={setReason}
        textareaRef={textareaRef}
      />
      {error && (
        <p className="mt-2 text-xs text-[var(--color-destructive)]">{error}</p>
      )}
      <ReopenDialogFootnote />
      <ReopenDialogActions
        pending={pending}
        onCancel={onCancel}
        onConfirm={handleConfirm}
      />
    </ReopenDialogShell>,
    document.body,
  );
}

// Backdrop + centred surface. Clicking the backdrop dismisses; clicks inside
// the surface are stopped so they never reach it.
function ReopenDialogShell({
  surfaceRef,
  onDismiss,
  onKeyDown,
  children,
}: {
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
  readonly onDismiss: () => void;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
  readonly children: ReactNode;
}) {
  return (
    <DialogSurface
      surfaceRef={surfaceRef}
      onDismiss={onDismiss}
      onBackdropKeyDown={onKeyDown}
      backdropClassName="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      surfaceClassName="w-full max-w-lg rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-6 shadow-2xl"
      ariaLabel="Request Reopen dialog"
    >
      {children}
    </DialogSurface>
  );
}

// Pins initial focus to the note field: the shared focus primitive lands on the
// first focusable, which is not what this dialog is for. Deferred a frame so
// the portal is mounted first.
function useFocusOnMount(ref: RefObject<HTMLTextAreaElement | null>) {
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      ref.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [ref]);
}

function ReopenDialogHeader() {
  return (
    <>
      <h2 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
        Request Reopen
      </h2>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        Ask Head to unlock this section. A short note about what you need to
        change makes it easier to approve quickly.
      </p>
    </>
  );
}

function ReopenDialogFootnote() {
  return (
    <p className="mt-3 text-[11px] text-[var(--color-muted-foreground)]">
      Once submitted, Head will see the request and either reopen the section or
      leave a note. You'll be notified by email.
    </p>
  );
}

interface ReopenReasonFieldProps {
  readonly reason: string;
  readonly onReasonChange: (next: string) => void;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
}

function ReopenReasonField({
  reason,
  onReasonChange,
  textareaRef,
}: ReopenReasonFieldProps) {
  return (
    <div className="mt-4">
      <label
        htmlFor="reopen-reason"
        className="mb-1 block text-xs font-semibold text-[var(--color-muted-foreground)]"
      >
        Reason{" "}
        <span className="font-normal text-[var(--color-muted-foreground)]">
          (optional, max {MAX_REOPEN_REASON_LENGTH} chars)
        </span>
      </label>
      <textarea
        id="reopen-reason"
        ref={textareaRef}
        className="w-full resize-y rounded-xl border border-[rgba(0,0,0,0.2)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-starbucks-accent)] focus:shadow-[0_0_0_3px_rgba(0,117,74,0.15)] focus:outline-none"
        style={{ minHeight: "80px" }}
        maxLength={MAX_REOPEN_REASON_LENGTH}
        value={reason}
        onChange={(e) => onReasonChange(e.target.value)}
        placeholder="e.g. Forgot to add the carry-over from last week."
      />
      <div className="mt-1 text-right text-[11px] text-[var(--color-muted-foreground)]">
        {reason.length}/{MAX_REOPEN_REASON_LENGTH}
      </div>
    </div>
  );
}

interface ReopenDialogActionsProps {
  readonly pending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function ReopenDialogActions({
  pending,
  onCancel,
  onConfirm,
}: ReopenDialogActionsProps) {
  return (
    <div className="mt-5 flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[40px] items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[40px] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-starbucks-accent)] disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send Request"}
      </button>
    </div>
  );
}
