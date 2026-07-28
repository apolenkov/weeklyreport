import {
  formatDateTime,
  formatPeriodRangeWithYear,
  joinPeriodLabel,
} from "../../../lib/format-date";
import {
  type ReopenDecision,
  ReopenRespondForm,
} from "../../../shared/ui/reopen-respond-form";

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

const STATUS_LABEL: Record<ReopenRequest["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_PALETTE: Record<ReopenRequest["status"], string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-[var(--color-success)] text-[var(--color-starbucks-accent)]",
  rejected: "bg-red-100 text-red-900",
};

function formatPeriod(
  periodStart: string,
  periodEnd: string,
  label: string | null,
): string {
  return joinPeriodLabel(
    label,
    formatPeriodRangeWithYear(periodStart, periodEnd),
  );
}

function ReopenRequestMeta({
  request: r,
}: {
  readonly request: ReopenRequest;
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]">
          {r.requestedBy.name}
        </span>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {r.requestedBy.email}
        </span>
        <span
          className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_PALETTE[r.status]}`}
        >
          {STATUS_LABEL[r.status]}
        </span>
      </div>
      <div className="text-xs text-[var(--color-muted-foreground)]">
        {formatPeriod(
          r.report.periodStart,
          r.report.periodEnd,
          r.report.weekLabel,
        )}
        {" · submitted "}
        {formatDateTime(r.createdAt)}
      </div>
    </div>
  );
}

function ReopenRequestNotes({
  request: r,
}: {
  readonly request: ReopenRequest;
}) {
  return (
    <>
      {r.reason && (
        <div className="mt-3 rounded-[var(--radius)] bg-[var(--color-surface-hover)] p-3 text-sm text-[var(--color-foreground)]">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Reason
          </div>
          <div className="mt-1 whitespace-pre-wrap">{r.reason}</div>
        </div>
      )}

      {r.status !== "pending" && r.reviewNote && (
        <div className="mt-3 rounded-[var(--radius)] border border-[var(--color-border)] p-3 text-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Head Comment
          </div>
          <div className="mt-1 whitespace-pre-wrap">{r.reviewNote}</div>
          {r.reviewedBy && r.reviewedAt && (
            <div className="mt-2 text-[11px] text-[var(--color-muted-foreground)]">
              {r.reviewedBy.name} · {formatDateTime(r.reviewedAt)}
            </div>
          )}
        </div>
      )}
    </>
  );
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
