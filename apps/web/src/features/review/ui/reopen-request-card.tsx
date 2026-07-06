import {
  formatPeriodRangeWithYear,
  joinPeriodLabel,
} from "../../../lib/format-date";

type ReopenStatus = "pending" | "approved" | "rejected";

const STATUS_LABEL: Record<ReopenStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_PALETTE: Record<ReopenStatus, string> = {
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

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
 * One reopen-request card (extracted from reopen-tab.tsx): requester +
 * status chip, period/submitted meta, the reason/head-comment blocks, and
 * the inline approve/reject responder when this card is the one being
 * answered.
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
  const palette = STATUS_PALETTE[r.status];
  const statusLabel = STATUS_LABEL[r.status];

  return (
    <li className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]">
              {r.requestedBy.name}
            </span>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {r.requestedBy.email}
            </span>
            <span
              className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${palette}`}
            >
              {statusLabel}
            </span>
          </div>
          <div className="text-xs text-[var(--color-muted-foreground)]">
            {formatPeriod(
              r.report.periodStart,
              r.report.periodEnd,
              r.report.weekLabel,
            )}
            {" · submitted "}
            {formatTimestamp(r.createdAt)}
          </div>
        </div>
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
              {r.reviewedBy.name} · {formatTimestamp(r.reviewedAt)}
            </div>
          )}
        </div>
      )}

      {isResponding && (
        <div className="mt-3 space-y-2 rounded-[var(--radius)] border border-[var(--color-starbucks-accent)] bg-[rgba(0,117,74,0.04)] p-3">
          <label
            htmlFor={`note-${r.id}`}
            className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]"
          >
            Comment (optional, up to 500 characters)
          </label>
          <textarea
            id={`note-${r.id}`}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            maxLength={500}
            placeholder="Example: approved, please move the deadline to Friday 15:00"
            className="w-full resize-y rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[var(--color-starbucks-accent)] focus:outline-none"
            style={{ minHeight: "60px" }}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancelRespond}
              disabled={isSaving}
              className="btn-press inline-flex items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-2 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={isSaving}
              className="btn-press inline-flex items-center rounded-[var(--radius-pill)] bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onApprove}
              disabled={isSaving}
              className="btn-press inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary)] disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Approve"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
