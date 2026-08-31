"use client";

interface RecordDialogFooterProps {
  readonly saveLabel: string;
  readonly onCancel: () => void;
  readonly onSave: () => void;
  readonly onDelete?: (() => void) | undefined;
  readonly saveDisabled?: boolean | undefined;
  readonly savePending?: boolean | undefined;
  readonly sticky?: boolean | undefined;
}

export function RecordDialogFooter({
  saveLabel,
  onCancel,
  onSave,
  onDelete,
  saveDisabled = false,
  savePending = false,
  sticky = false,
}: RecordDialogFooterProps) {
  return (
    <div
      className={
        sticky
          ? "sticky bottom-0 mt-5 flex flex-wrap justify-end gap-3 border-t bg-[var(--color-popover)] pt-3"
          : "mt-5 flex flex-wrap justify-end gap-3"
      }
    >
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="btn-press mr-auto inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-destructive)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-destructive)] transition-colors hover:bg-[var(--color-destructive-surface-subtle)] md:min-h-[40px]"
        >
          Delete
        </button>
      ) : null}
      <button
        type="button"
        onClick={onCancel}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] md:min-h-[40px]"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saveDisabled || savePending}
        aria-busy={savePending || undefined}
        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50 md:min-h-[40px]"
      >
        {savePending ? "Saving…" : saveLabel}
      </button>
      {savePending ? (
        <span className="sr-only" role="status" aria-live="polite">
          Saving…
        </span>
      ) : null}
    </div>
  );
}
