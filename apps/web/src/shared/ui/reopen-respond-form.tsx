"use client";

export type ReopenDecision = "approved" | "rejected";

export interface ReopenRespondFormProps {
  readonly requestId: string;
  readonly note: string;
  readonly onNoteChange: (note: string) => void;
  readonly onCancel: () => void;
  readonly onReject: () => void;
  readonly onApprove: () => void;
  readonly isPending: boolean;
  readonly pendingDecision: ReopenDecision | undefined;
}

// Matches admin.respondReopenRequest note cap on the API.
const MAX_REOPEN_NOTE_LENGTH = 500;

function ReopenRespondActions({
  onCancel,
  onReject,
  onApprove,
  isPending,
  pendingDecision,
}: Pick<
  ReopenRespondFormProps,
  "onCancel" | "onReject" | "onApprove" | "isPending" | "pendingDecision"
>) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className="btn-press inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onReject}
        disabled={isPending}
        className="btn-press inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-destructive)] px-4 py-2 text-xs font-semibold text-[var(--color-destructive-foreground)] hover:bg-destructive/90 disabled:opacity-50"
      >
        {isPending && pendingDecision === "rejected" ? "Saving…" : "Reject"}
      </button>
      <button
        type="button"
        onClick={onApprove}
        disabled={isPending}
        className="btn-press inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-xs font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)] disabled:opacity-50"
      >
        {isPending && pendingDecision === "approved" ? "Saving…" : "Approve"}
      </button>
    </div>
  );
}

export function ReopenRespondForm({
  requestId,
  note,
  onNoteChange,
  onCancel,
  onReject,
  onApprove,
  isPending,
  pendingDecision,
}: ReopenRespondFormProps) {
  return (
    <div className="mt-3 space-y-2 rounded-[var(--radius)] border border-[var(--color-starbucks-accent)] bg-[var(--color-approval-surface)] p-3">
      <label
        htmlFor={`reopen-note-${requestId}`}
        className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]"
      >
        {`Comment (optional, up to ${MAX_REOPEN_NOTE_LENGTH} characters)`}
      </label>
      <textarea
        id={`reopen-note-${requestId}`}
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        maxLength={MAX_REOPEN_NOTE_LENGTH}
        placeholder="Example: approved, please update the report."
        className="w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm focus:border-[var(--color-starbucks-accent)] focus:outline-none"
        style={{ minHeight: "60px" }}
      />
      <ReopenRespondActions
        onCancel={onCancel}
        onReject={onReject}
        onApprove={onApprove}
        isPending={isPending}
        pendingDecision={pendingDecision}
      />
    </div>
  );
}
