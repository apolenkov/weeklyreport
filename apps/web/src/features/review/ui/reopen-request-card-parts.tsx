import {
  formatDateTime,
  formatPeriodRangeWithYear,
  joinPeriodLabel,
} from "../../../lib/format-date";
import type { ReopenRequest } from "./reopen-request-card";

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

export function ReopenRequestMeta({
  request: r,
}: {
  readonly request: ReopenRequest;
}) {
  const palette = STATUS_PALETTE[r.status];
  const statusLabel = STATUS_LABEL[r.status];

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
        {formatDateTime(r.createdAt)}
      </div>
    </div>
  );
}

export function ReopenRequestNotes({
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
