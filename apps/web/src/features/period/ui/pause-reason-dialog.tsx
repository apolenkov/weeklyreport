"use client";

import {
  hasVisibleText,
  INVISIBLE_TEXT_MESSAGE,
  SAFE_TEXT_MAX_LENGTH,
} from "@weeklyreport/shared";
import { useRef, useState } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import { DialogSurface } from "../../../shared/ui/dialogs/dialog-surface";
import { DocumentBodyPortal } from "../../../shared/ui/dialogs/document-body-portal";
import { RecordTextareaField } from "../../../shared/ui/forms/record-textarea-field";

// Persisted pause reasons pass through safeText's default bound and visible-text
// rule (section-record pausedReason); gate the confirmed trimmed value on the
// same bound so oversized and invisible-only pastes fail visibly instead of at
// persistence, where one such field rejects the whole autosave draft.

interface PauseReasonDialogProps {
  readonly open: boolean;
  readonly preview: string;
  readonly initialReason?: string;
  readonly onConfirm: (reason: string) => void;
  readonly onCancel: () => void;
}

// Required pause-reason prompt: confirm stays disabled until non-empty.
// Portaled to escape overflow:hidden.
export function PauseReasonDialog({
  open,
  ...contentProps
}: PauseReasonDialogProps) {
  // Form remounts each open so reason seeds from initialReason without a reset effect.
  if (!open) return null;
  return <PauseReasonDialogContent {...contentProps} />;
}

function PauseReasonDialogContent({
  preview,
  initialReason = "",
  onConfirm,
  onCancel,
}: Omit<PauseReasonDialogProps, "open">) {
  const [reason, setReason] = useState(initialReason);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Escape/Tab-trap/focus-restore via shared primitive; first focusable (textarea) autofocuses.
  useDialogFocus({ open: true, onClose: onCancel, containerRef: surfaceRef });

  const trimmed = reason.trim();
  const isTooLong = trimmed.length > SAFE_TEXT_MAX_LENGTH;
  // Blank still means "not entered yet"; non-blank invisible-only text keeps the
  // typed value for correction, as the item editor does. The server rejects it.
  const isInvisibleOnly = trimmed.length > 0 && !hasVisibleText(trimmed);

  return (
    <DocumentBodyPortal>
      <DialogSurface
        surfaceRef={surfaceRef}
        onDismiss={onCancel}
        surfaceClassName="animate-scale-in mx-4 w-full max-w-md rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-popover)] p-6 shadow-xl"
        ariaLabelledBy="pause-reason-title"
      >
        <PauseReasonPreview preview={preview} />
        <PauseReasonField
          reason={reason}
          onReasonChange={setReason}
          error={isInvisibleOnly ? INVISIBLE_TEXT_MESSAGE : undefined}
        />
        <PauseReasonActions
          canConfirm={trimmed.length > 0 && !isTooLong && !isInvisibleOnly}
          onCancel={onCancel}
          onConfirm={() => onConfirm(trimmed)}
        />
      </DialogSurface>
    </DocumentBodyPortal>
  );
}

function PauseReasonPreview({ preview }: { readonly preview: string }) {
  return (
    <>
      <h3
        id="pause-reason-title"
        className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]"
      >
        Pause this item?
      </h3>

      <p
        className="mt-3 line-clamp-2 break-words rounded-md border border-[var(--color-muted)] bg-[var(--color-surface-hover)] px-3 py-2 text-sm font-medium text-[var(--color-foreground)]"
        title={preview}
      >
        {preview}
      </p>
    </>
  );
}

function PauseReasonField({
  reason,
  onReasonChange,
  error,
}: {
  readonly reason: string;
  readonly onReasonChange: (next: string) => void;
  readonly error?: string | undefined;
}) {
  return (
    <div className="mt-4">
      <RecordTextareaField
        id="pause-reason-input"
        label="Reason"
        required
        value={reason}
        onChange={onReasonChange}
        error={error}
        placeholder="Why is this paused? (e.g. waiting on a dependency)"
        minHeightPx={64}
        characterLimit={SAFE_TEXT_MAX_LENGTH}
        fill={false}
      />
    </div>
  );
}

function PauseReasonActions({
  canConfirm,
  onCancel,
  onConfirm,
}: {
  readonly canConfirm: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button
        type="button"
        className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[36px] items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-muted)] bg-transparent px-4 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)]"
        onClick={onCancel}
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={!canConfirm}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] md:min-h-[36px] items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onConfirm}
      >
        Pause
      </button>
    </div>
  );
}
