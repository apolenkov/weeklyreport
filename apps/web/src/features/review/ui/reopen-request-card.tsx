import {
  ReopenRequestMeta,
  ReopenRequestNotes,
  ReopenRespondForm,
} from "./reopen-request-card-parts";

type ReopenStatus = "pending" | "approved" | "rejected";

export interface ReopenRequest {
  readonly id: string;
  readonly status: ReopenStatus;
  readonly reason: string | null;
  readonly reviewNote: string | null;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly reviewedBy: { readonly name: string } | null;
  readonly requestedBy: { readonly name: string; readonly email: string };
  readonly report: {
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly weekLabel: string | null;
  };
}

/**
 * One reopen-request card: requester + status chip, period/submitted meta, the
 * reason/head-comment blocks, and the inline approve/reject responder when this
 * card is the one being answered.
 */
export function ReopenRequestCard({
  request: r,
  isResponding,
  note,
  isSaving,
  onStartRespond,
  onCancelRespond,
  onNoteChange,
  onReject,
  onApprove,
}: {
  readonly request: ReopenRequest;
  readonly isResponding: boolean;
  readonly note: string;
  readonly isSaving: boolean;
  readonly onStartRespond: () => void;
  readonly onCancelRespond: () => void;
  readonly onNoteChange: (value: string) => void;
  readonly onReject: () => void;
  readonly onApprove: () => void;
}) {
  return (
    <li className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ReopenRequestMeta request={r} />
        {r.status === "pending" && !isResponding && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onStartRespond}
              className="btn-press inline-flex items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
            >
              Respond
            </button>
          </div>
        )}
      </div>

      <ReopenRequestNotes request={r} />

      {isResponding && (
        <ReopenRespondForm
          requestId={r.id}
          note={note}
          isSaving={isSaving}
          onNoteChange={onNoteChange}
          onCancelRespond={onCancelRespond}
          onReject={onReject}
          onApprove={onApprove}
        />
      )}
    </li>
  );
}
