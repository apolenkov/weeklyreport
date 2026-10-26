"use client";

import { SAFE_TEXT_MAX_LENGTH } from "@weeklyreport/shared";
import { useRef, useState } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import { DialogSurface } from "../../../shared/ui/dialogs/dialog-surface";
import { DocumentBodyPortal } from "../../../shared/ui/dialogs/document-body-portal";
import { getPauseReasonError } from "../../../shared/ui/forms/pause-reason-validation";
import { RecordTextareaField } from "../../../shared/ui/forms/record-textarea-field";

// Persisted pause reasons pass through the server's safeText rule
// (section-record pausedReason); gate the confirmed trimmed value with the same
// helper the item editor uses so oversized, null-byte and invisible-only pastes
// fail visibly instead of at persistence, where one such field rejects the whole
// autosave draft.

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
  const pauseReasonError = getPauseReasonError(trimmed);
  // Blank still means "not entered yet"; only a typed invalid value is flagged
  // before confirm, while the item editor reports the required message on save.
  const visibleError = trimmed.length === 0 ? undefined : pauseReasonError;
  // The counter must measure the value Pause actually confirms: whitespace the
  // trim discards neither reaches the server nor counts against the limit.
  const savedReasonCharacterCount = Array.from(trimmed).length;

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
          characterCount={savedReasonCharacterCount}
          onReasonChange={setReason}
          error={visibleError}
        />
        <PauseReasonActions
          canConfirm={pauseReasonError === undefined}
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
  characterCount,
  onReasonChange,
  error,
}: {
  readonly reason: string;
  readonly characterCount: number;
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
        characterCount={characterCount}
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
