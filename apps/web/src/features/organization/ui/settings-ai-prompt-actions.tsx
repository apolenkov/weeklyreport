import { useState } from "react";

import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";

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

type Confirmation = "activate" | "restore" | "discard";

const confirmationCopy: Record<
  Confirmation,
  Readonly<{ title: string; description: string; label: string }>
> = {
  activate: {
    title: "Activate prompt version?",
    description: "Make this validated prompt version active for the assistant.",
    label: "Activate",
  },
  restore: {
    title: "Restore prompt version?",
    description: "Restore this prompt version as the editable draft.",
    label: "Restore",
  },
  discard: {
    title: "Discard prompt attempt?",
    description: "Discard this prompt attempt.",
    label: "Discard",
  },
};

function DiscardButton({
  busy,
  pending,
  onClick,
}: Readonly<{ busy: boolean; pending: boolean; onClick: () => void }>) {
  return (
    <button
      type="button"
      className="btn-press min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-destructive)] px-4 py-2 text-sm font-semibold text-[var(--color-destructive)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] hover:bg-[var(--color-status-blocked-bg)] disabled:opacity-50"
      disabled={busy}
      onClick={onClick}
    >
      {pending ? "Discarding…" : "Discard"}
    </button>
  );
}

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
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmAction = () => {
    if (confirmation === null) return;
    const callbacks: Record<Confirmation, () => void> = {
      activate: onActivate,
      restore: onRestore,
      discard: onDiscard,
    };
    callbacks[confirmation]();
    setConfirmation(null);
  };
  const copy = confirmation === null ? null : confirmationCopy[confirmation];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn-press min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] hover:bg-[var(--color-primary)] disabled:opacity-50"
        disabled={!canDraft || busy}
        onClick={onDraft}
      >
        {draftPending ? "Saving…" : "Save Draft"}
      </button>
      <button
        type="button"
        className="btn-press min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
        disabled={!canActivate || busy}
        onClick={() => setConfirmation("activate")}
      >
        {activatePending ? "Activating…" : "Activate"}
      </button>
      <button
        type="button"
        className="btn-press min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
        disabled={!canRestore || busy}
        onClick={() => setConfirmation("restore")}
      >
        {restorePending ? "Restoring…" : "Restore"}
      </button>
      {canDiscard && (
        <DiscardButton
          busy={busy}
          pending={discardPending}
          onClick={() => setConfirmation("discard")}
        />
      )}
      {dirty && (
        <span className="text-xs text-[var(--color-muted-foreground)]">
          Unsaved edits — save the draft before activating or restoring.
        </span>
      )}
      <ConfirmationDialog
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={confirmAction}
        title={copy?.title ?? "Confirm prompt action"}
        description={copy?.description ?? "Confirm this prompt action."}
        confirmLabel={copy?.label ?? "Confirm"}
        variant={confirmation === "discard" ? "destructive" : "default"}
      />
    </div>
  );
}
