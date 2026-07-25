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

/**
 * Reopen Request Meta.
 * @param options - The options argument.
 */
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

/**
 * Reopen Request Notes.
 * @param options - The options argument.
 */
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

export interface ReopenRespondFormProps {
  readonly requestId: string;
  readonly note: string;
  readonly isSaving: boolean;
  readonly onNoteChange: (value: string) => void;
  readonly onCancelRespond: () => void;
  readonly onReject: () => void;
  readonly onApprove: () => void;
}

// Matches admin.respondReopenRequest note cap on the API.
const MAX_REOPEN_NOTE_LENGTH = 500;

function ReopenRespondActions({
  isSaving,
  onCancelRespond,
  onReject,
  onApprove,
}: Pick<
  ReopenRespondFormProps,
  "isSaving" | "onCancelRespond" | "onReject" | "onApprove"
>) {
  return (
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
  );
}

/**
 * Reopen Respond Form.
 * @param props - The props argument.
 */
export function ReopenRespondForm({
  requestId,
  note,
  isSaving,
  onNoteChange,
  onCancelRespond,
  onReject,
  onApprove,
}: ReopenRespondFormProps) {
  return (
    <div className="mt-3 space-y-2 rounded-[var(--radius)] border border-[var(--color-starbucks-accent)] bg-[rgba(0,117,74,0.04)] p-3">
      <label
        htmlFor={`note-${requestId}`}
        className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]"
      >
        {`Comment (optional, up to ${MAX_REOPEN_NOTE_LENGTH} characters)`}
      </label>
      <textarea
        id={`note-${requestId}`}
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        maxLength={MAX_REOPEN_NOTE_LENGTH}
        placeholder="Example: approved, please move the deadline to Friday 15:00"
        className="w-full resize-y rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm focus:border-[var(--color-starbucks-accent)] focus:outline-none"
        style={{ minHeight: "60px" }}
      />
      <ReopenRespondActions
        isSaving={isSaving}
        onCancelRespond={onCancelRespond}
        onReject={onReject}
        onApprove={onApprove}
      />
    </div>
  );
}
