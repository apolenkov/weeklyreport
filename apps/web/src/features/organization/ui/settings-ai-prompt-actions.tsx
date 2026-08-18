type PromptActionsProps = Readonly<{
  busy: boolean;
  canDraft: boolean;
  canActivate: boolean;
  canRestore: boolean;
  canDiscard: boolean;
  draftPending: boolean;
  activatePending: boolean;
  restorePending: boolean;
  discardPending: boolean;
  dirty: boolean;
  onDraft: () => void;
  onActivate: () => void;
  onRestore: () => void;
  onDiscard: () => void;
}>;

export function PromptActions({
  busy,
  canDraft,
  canActivate,
  canRestore,
  canDiscard,
  draftPending,
  activatePending,
  restorePending,
  discardPending,
  dirty,
  onDraft,
  onActivate,
  onRestore,
  onDiscard,
}: PromptActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        disabled={!canDraft || busy}
        onClick={onDraft}
      >
        {draftPending ? "Saving…" : "Save Draft"}
      </button>
      <button
        type="button"
        className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        disabled={!canActivate || busy}
        onClick={() => {
          if (window.confirm("Activate this prompt version globally?")) {
            onActivate();
          }
        }}
      >
        {activatePending ? "Activating…" : "Activate"}
      </button>
      <button
        type="button"
        className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
        disabled={!canRestore || busy}
        onClick={() => {
          if (window.confirm("Restore this prompt version globally?")) {
            onRestore();
          }
        }}
      >
        {restorePending ? "Restoring…" : "Restore"}
      </button>
      {canDiscard && (
        <button
          type="button"
          className="btn-press rounded-[var(--radius-pill)] border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            if (window.confirm("Discard this prompt attempt?")) {
              onDiscard();
            }
          }}
        >
          {discardPending ? "Discarding…" : "Discard"}
        </button>
      )}
      {dirty && (
        <span className="text-xs text-[var(--color-muted-foreground)]">
          Unsaved edits
        </span>
      )}
    </div>
  );
}
