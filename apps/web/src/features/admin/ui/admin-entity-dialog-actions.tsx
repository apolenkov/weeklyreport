"use client";

interface AdminEntityDialogActionsProps {
  readonly canSave: boolean;
  readonly isSaving: boolean;
  readonly saveLabel: string;
  readonly onClose: () => void;
  readonly saveButtonAttributes?: Readonly<Record<string, string>>;
}

export function AdminEntityDialogActions({
  canSave,
  isSaving,
  saveLabel,
  onClose,
  saveButtonAttributes,
}: AdminEntityDialogActionsProps) {
  return (
    <div className="mt-6 flex justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={isSaving}
        className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] max-md:min-h-[var(--touch-target-min)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSaving || !canSave}
        {...saveButtonAttributes}
        className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] max-md:min-h-[var(--touch-target-min)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
