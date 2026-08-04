"use client";

interface UserEditDialogActionsProps {
  readonly canSave: boolean;
  readonly isSaving: boolean;
  readonly saveLabel: string;
  readonly onSave: () => void;
  readonly onClose: () => void;
}

export function UserEditDialogActions({
  canSave,
  isSaving,
  saveLabel,
  onSave,
  onClose,
}: UserEditDialogActionsProps) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={isSaving}
        className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
