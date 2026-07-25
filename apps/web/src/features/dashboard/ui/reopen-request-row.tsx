"use client";

import {
  formatDateTime,
  formatPeriodRangeWithYear,
  joinPeriodLabel,
} from "../../../lib/format-date";
import { ReopenRequestRespondForm } from "./reopen-request-respond-form";

interface DashboardReopenRequest {
  readonly id: string;
  readonly reason: string | null;
  readonly createdAt: string;
  readonly requestedBy: { readonly name: string };
  readonly report: {
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly weekLabel: string | null;
  };
}

interface ReopenRequestRowProps {
  readonly request: DashboardReopenRequest;
  readonly isResponding: boolean;
  readonly note: string;
  readonly onNoteChange: (note: string) => void;
  readonly onStartRespond: () => void;
  readonly onCancel: () => void;
  readonly onReject: () => void;
  readonly onApprove: () => void;
  readonly isPending: boolean;
  readonly pendingDecision: "approved" | "rejected" | undefined;
}

function ReopenRequestHeader({
  request: r,
  isResponding,
  onStartRespond,
}: {
  readonly request: DashboardReopenRequest;
  readonly isResponding: boolean;
  readonly onStartRespond: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-foreground)]">
            {r.requestedBy.name}
          </span>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {joinPeriodLabel(
              r.report.weekLabel,
              formatPeriodRangeWithYear(
                r.report.periodStart,
                r.report.periodEnd,
              ),
            )}
          </span>
        </div>
        <div className="text-xs text-[var(--color-muted-foreground)]">
          Requested {formatDateTime(r.createdAt)}
        </div>
      </div>
      {!isResponding && (
        <button
          type="button"
          onClick={onStartRespond}
          className="btn-press inline-flex items-center rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)]"
        >
          Respond
        </button>
      )}
    </div>
  );
}

export function ReopenRequestRow({
  request: r,
  isResponding,
  note,
  onNoteChange,
  onStartRespond,
  onCancel,
  onReject,
  onApprove,
  isPending,
  pendingDecision,
}: ReopenRequestRowProps) {
  return (
    <li className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
      <ReopenRequestHeader
        request={r}
        isResponding={isResponding}
        onStartRespond={onStartRespond}
      />

      {r.reason && (
        <div className="mt-2 rounded-[var(--radius)] bg-[var(--color-surface-hover)] p-2 text-sm text-[var(--color-foreground)]">
          <span className="whitespace-pre-wrap">{r.reason}</span>
        </div>
      )}

      {isResponding && (
        <ReopenRequestRespondForm
          requestId={r.id}
          note={note}
          onNoteChange={onNoteChange}
          onCancel={onCancel}
          onReject={onReject}
          onApprove={onApprove}
          isPending={isPending}
          pendingDecision={pendingDecision}
        />
      )}
    </li>
  );
}
