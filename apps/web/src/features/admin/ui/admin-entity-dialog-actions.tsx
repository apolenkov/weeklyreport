"use client";

interface AdminEntityDialogActionsProps {
  readonly canSave: boolean;
  readonly isSaving: boolean;
  readonly saveLabel: string;
  readonly onClose: () => void;
  readonly saveDisabled?: boolean;
  readonly cancelDisabled?: boolean;
  readonly onDelete?: (() => void) | undefined;
  readonly deleteLabel?: string;
  readonly saveButtonAttributes?: Readonly<Record<string, string>>;
}

export function AdminEntityDialogActions({
  canSave,
  isSaving,
  saveLabel,
  onClose,
  saveDisabled,
  cancelDisabled,
  onDelete,
  deleteLabel = "Delete",
  saveButtonAttributes,
}: AdminEntityDialogActionsProps) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={isSaving}
          className="btn-press mr-auto rounded-[var(--radius-pill)] border border-[var(--color-destructive)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-destructive)] transition-colors hover:bg-[var(--color-destructive-surface-subtle)] max-md:min-h-[var(--touch-target-min)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleteLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        disabled={cancelDisabled ?? isSaving}
        className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] max-md:min-h-[var(--touch-target-min)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saveDisabled ?? !canSave}
        {...saveButtonAttributes}
        className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] max-md:min-h-[var(--touch-target-min)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
