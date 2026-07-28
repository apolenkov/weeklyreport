import {
  type ReopenDecision,
  ReopenRespondForm,
} from "../../../shared/ui/reopen-respond-form";
import {
  ReopenRequestMeta,
  ReopenRequestNotes,
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

function RespondButton({
  onStartRespond,
}: {
  readonly onStartRespond: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onStartRespond}
        className="btn-press inline-flex items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
      >
        Respond
      </button>
    </div>
  );
}

export function ReopenRequestCard({
  request: r,
  isResponding,
  note,
  isSaving,
  pendingDecision,
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
  readonly pendingDecision: ReopenDecision | undefined;
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
          <RespondButton onStartRespond={onStartRespond} />
        )}
      </div>

      <ReopenRequestNotes request={r} />

      {isResponding && (
        <ReopenRespondForm
          requestId={r.id}
          note={note}
          isPending={isSaving}
          pendingDecision={pendingDecision}
          onNoteChange={onNoteChange}
          onCancel={onCancelRespond}
          onReject={onReject}
          onApprove={onApprove}
        />
      )}
    </li>
  );
}
