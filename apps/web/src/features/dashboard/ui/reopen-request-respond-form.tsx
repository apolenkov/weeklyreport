"use client";

interface ReopenRequestRespondFormProps {
  readonly requestId: string;
  readonly note: string;
  readonly onNoteChange: (note: string) => void;
  readonly onCancel: () => void;
  readonly onReject: () => void;
  readonly onApprove: () => void;
  readonly isPending: boolean;
  readonly pendingDecision: "approved" | "rejected" | undefined;
}

/** Note textarea + Cancel/Reject/Approve; each button's own pending label is
 * driven by which decision is actually in flight, not by isPending alone —
 * otherwise both buttons would show "Saving…" no matter which was clicked. */
export function ReopenRequestRespondForm({
  requestId,
  note,
  onNoteChange,
  onCancel,
  onReject,
  onApprove,
  isPending,
  pendingDecision,
}: ReopenRequestRespondFormProps) {
  return (
    <div className="mt-3 space-y-2 rounded-[var(--radius)] border border-[var(--color-starbucks-accent)] bg-[rgba(0,117,74,0.04)] p-3">
      <label
        htmlFor={`reopen-card-note-${requestId}`}
        className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]"
      >
        Comment (optional, up to 500 characters)
      </label>
      <textarea
        id={`reopen-card-note-${requestId}`}
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        maxLength={500}
        placeholder="Example: approved, please update the carry-over."
        className="w-full resize-y rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[var(--color-starbucks-accent)] focus:outline-none"
        style={{ minHeight: "60px" }}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="btn-press inline-flex items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={isPending}
          className="btn-press inline-flex items-center rounded-[var(--radius-pill)] bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isPending && pendingDecision === "rejected" ? "Saving…" : "Reject"}
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={isPending}
          className="btn-press inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary)] disabled:opacity-50"
        >
          {isPending && pendingDecision === "approved" ? "Saving…" : "Approve"}
        </button>
      </div>
    </div>
  );
}
