"use client";

import { MAX_REOPEN_REASON_LENGTH } from "@customreport/shared";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import { DialogSurface } from "../../../shared/ui/dialogs/dialog-surface";
import { DocumentBodyPortal } from "../../../shared/ui/dialogs/document-body-portal";
import { useDiscardGuard } from "../../../shared/ui/dialogs/use-discard-guard";
import { RecordTextareaField } from "../../../shared/ui/forms/record-textarea-field";

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
  if (!open) return null;
  return <RequestReopenDialogContent {...contentProps} />;
}

function RequestReopenDialogContent({
  pending = false,
  error,
  onConfirm,
  onCancel,
}: Omit<RequestReopenDialogProps, "open">) {
  const [reason, setReason] = useState("");
  const dialogSurfaceRef = useRef<HTMLDivElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const headingId = useId();
  const isTooLong = Array.from(reason).length > MAX_REOPEN_REASON_LENGTH;
  const { requestClose, discardDialog } = useDiscardGuard(
    reason.trim().length > 0,
    onCancel,
  );

  // While the request is in flight the dialog stays put: no keyboard submit,
  // no Escape/backdrop dismissal — the submit cannot be abandoned mid-flight.
  const guardedCancel = pending ? () => undefined : requestClose;

  // Escape + focus trap + restore-to-trigger via the shared primitive. The
  // content component exists only while open.
  useDialogFocus({
    open: true,
    onClose: guardedCancel,
    containerRef: dialogSurfaceRef,
  });

  // The field is disabled while sending, which drops focus; a failed submit
  // hands it back so the lead can retry without re-finding the field.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) reasonRef.current?.focus();
    wasPending.current = pending;
  }, [pending]);

  function handleConfirm() {
    if (pending || isTooLong) return;
    const trimmed = reason.trim();
    onConfirm(trimmed.length > 0 ? trimmed : undefined);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleConfirm();
    }
  }

  return (
    <DocumentBodyPortal>
      <ReopenDialogShell
        surfaceRef={dialogSurfaceRef}
        headingId={headingId}
        pending={pending}
        onDismiss={guardedCancel}
        onKeyDown={handleKeyDown}
      >
        <ReopenDialogHeader headingId={headingId} />
        <ReopenReasonField
          reason={reason}
          onChange={setReason}
          pending={pending}
          error={error}
          textareaRef={reasonRef}
        />
        <ReopenDialogFootnote />
        <ReopenDialogActions
          pending={pending}
          sendDisabled={isTooLong}
          onCancel={requestClose}
          onConfirm={handleConfirm}
        />
      </ReopenDialogShell>
      {discardDialog}
    </DocumentBodyPortal>
  );
}

function ReopenReasonField({
  reason,
  onChange,
  pending,
  error,
  textareaRef,
}: {
  readonly reason: string;
  readonly onChange: (reason: string) => void;
  readonly pending: boolean;
  readonly error: string | null | undefined;
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <>
      <div className="mt-4">
        <RecordTextareaField
          id="reopen-reason"
          label="Reason (optional)"
          value={reason}
          onChange={onChange}
          placeholder="e.g. Forgot to add the carry-over from last week…"
          minHeightPx={80}
          characterLimit={MAX_REOPEN_REASON_LENGTH}
          fill={false}
          focusOnMount
          textareaRef={textareaRef}
          disabled={pending}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="mt-2 text-xs text-[var(--color-destructive)]"
        >
          {error}
        </p>
      )}
    </>
  );
}

// Backdrop + centred surface. Clicking the backdrop dismisses; clicks inside
// the surface are stopped so they never reach it.
function ReopenDialogShell({
  surfaceRef,
  headingId,
  pending,
  onDismiss,
  onKeyDown,
  children,
}: {
  readonly surfaceRef: RefObject<HTMLDivElement | null>;
  readonly headingId: string;
  readonly pending: boolean;
  readonly onDismiss: () => void;
  readonly onKeyDown: (e: React.KeyboardEvent) => void;
  readonly children: ReactNode;
}) {
  return (
    <DialogSurface
      isPending={pending}
      surfaceRef={surfaceRef}
      onDismiss={onDismiss}
      onBackdropKeyDown={onKeyDown}
      surfaceClassName="mx-4 w-full max-w-lg rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-2xl"
      ariaLabelledBy={headingId}
    >
      {children}
    </DialogSurface>
  );
}

function ReopenDialogHeader({ headingId }: { readonly headingId: string }) {
  return (
    <>
      <h2
        id={headingId}
        className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]"
      >
        Request reopen
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
    <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
      Once submitted, Head will see the request and either reopen the section or
      leave a note. You'll be notified by email.
    </p>
  );
}

interface ReopenDialogActionsProps {
  readonly pending: boolean;
  readonly sendDisabled: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function ReopenDialogActions({
  pending,
  sendDisabled,
  onCancel,
  onConfirm,
}: ReopenDialogActionsProps) {
  return (
    <div className="mt-5 flex justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[40px] items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={pending || sendDisabled}
        aria-busy={pending || undefined}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[40px] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-starbucks-accent)] disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send request"}
      </button>
      {pending ? (
        <span className="sr-only" role="status" aria-live="polite">
          Sending…
        </span>
      ) : null}
    </div>
  );
}
