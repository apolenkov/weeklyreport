"use client";

import { MAX_REOPEN_NOTE_LENGTH } from "@weeklyreport/shared";
import type { Ref } from "react";

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
  readonly textareaRef?: Ref<HTMLTextAreaElement> | undefined;
}

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
        className="btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="button"
        data-interaction-effect="mutation-required"
        onClick={onReject}
        disabled={isPending}
        className="btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] bg-[var(--color-destructive)] px-4 py-2 text-xs font-semibold text-[var(--color-destructive-foreground)] hover:bg-destructive/90 disabled:opacity-50"
      >
        {isPending && pendingDecision === "rejected" ? "Saving…" : "Reject"}
      </button>
      <button
        type="button"
        data-interaction-effect="mutation-required"
        onClick={onApprove}
        disabled={isPending}
        className="btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-xs font-semibold text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)] disabled:opacity-50"
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
  textareaRef,
}: ReopenRespondFormProps) {
  return (
    <div className="mt-3 space-y-2 rounded-[var(--radius)] border border-[var(--color-starbucks-accent)] bg-[var(--color-approval-surface)] p-3">
      <label
        htmlFor={`reopen-note-${requestId}`}
        className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]"
      >
        {`Comment (optional, up to ${MAX_REOPEN_NOTE_LENGTH} characters)`}
      </label>
      <textarea
        ref={textareaRef}
        id={`reopen-note-${requestId}`}
        name="reopen-note"
        autoComplete="off"
        value={note}
        disabled={isPending}
        onChange={(event) => onNoteChange(event.target.value)}
        maxLength={MAX_REOPEN_NOTE_LENGTH}
        placeholder="Example: approved, please update the report…"
        className="w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm focus-visible:border-[var(--color-starbucks-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)]"
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
