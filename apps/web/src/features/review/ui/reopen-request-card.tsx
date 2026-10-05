import { isReopenAutoCloseNote } from "@customreport/shared";
import { type Ref, useEffect, useRef } from "react";

import {
  formatDateTime,
  formatPeriodRangeWithYear,
  joinPeriodLabel,
} from "../../../shared/lib/format/format-date";
import {
  type ReopenDecision,
  ReopenRespondForm,
} from "../../../shared/ui/forms/reopen-respond-form";

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

// The system closes superseded requests as `rejected` with a shared auto-close
// note (openspec/specs/reopen-requests); the reviewer FK cannot mark it because
// deleting a user nulls it.
function isSystemClosed(r: ReopenRequest): boolean {
  return r.status === "rejected" && isReopenAutoCloseNote(r.reviewNote);
}

const STATUS_LABEL: Record<ReopenRequest["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_PALETTE: Record<ReopenRequest["status"], string> = {
  pending:
    "bg-[var(--color-status-at-risk-bg)] text-[var(--color-status-at-risk-fg)]",
  approved: "bg-[var(--color-success)] text-[var(--color-starbucks-accent)]",
  rejected:
    "bg-[var(--color-status-blocked-bg)] text-[var(--color-destructive)]",
};

const NEUTRAL_PALETTE =
  "bg-[var(--color-surface-hover)] text-[var(--color-muted-foreground)]";

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
  const systemClosed = isSystemClosed(r);
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
          className={`rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${systemClosed ? NEUTRAL_PALETTE : STATUS_PALETTE[r.status]}`}
        >
          {systemClosed ? "Auto-closed" : STATUS_LABEL[r.status]}
        </span>
      </div>
      <div className="text-xs text-[var(--color-muted-foreground)]">
        {formatPeriod(
          r.report.periodStart,
          r.report.periodEnd,
          r.report.weekLabel,
        )}
        {" · requested "}
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
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Reason
          </div>
          <div className="mt-1 whitespace-pre-wrap">{r.reason}</div>
        </div>
      )}

      {r.status !== "pending" && r.reviewNote && (
        <div className="mt-3 rounded-[var(--radius)] border border-[var(--color-border)] p-3 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {isSystemClosed(r) ? "System Note" : "Head Comment"}
          </div>
          <div className="mt-1 whitespace-pre-wrap">{r.reviewNote}</div>
          {r.reviewedBy && r.reviewedAt && (
            <div className="mt-2 text-xs text-[var(--color-muted-foreground)]">
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
  isSaving,
  buttonRef,
}: {
  readonly onStartRespond: () => void;
  readonly isSaving: boolean;
  readonly buttonRef: Ref<HTMLButtonElement>;
}) {
  return (
    <div className="flex gap-2">
      <button
        ref={buttonRef}
        type="button"
        disabled={isSaving}
        onClick={onStartRespond}
        className="btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
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
  const respondButtonRef = useRef<HTMLButtonElement>(null);
  const noteFieldRef = useRef<HTMLTextAreaElement>(null);
  const restoreFocusAfterCancelRef = useRef(false);

  // Opening the form focuses its field; Cancel returns to the Respond button
  // that the form replaced. A decision is handled by the list (ReopenTab).
  useEffect(() => {
    if (isResponding) {
      noteFieldRef.current?.focus();
    } else if (restoreFocusAfterCancelRef.current) {
      restoreFocusAfterCancelRef.current = false;
      respondButtonRef.current?.focus();
    }
  }, [isResponding]);

  return (
    <li className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-card-resting)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ReopenRequestMeta request={r} />
        {r.status === "pending" && !isResponding && (
          <RespondButton
            onStartRespond={onStartRespond}
            isSaving={isSaving}
            buttonRef={respondButtonRef}
          />
        )}
      </div>

      <ReopenRequestNotes request={r} />

      {isResponding && (
        <ReopenRespondForm
          requestId={r.id}
          note={note}
          isPending={isSaving}
          pendingDecision={pendingDecision}
          textareaRef={noteFieldRef}
          onNoteChange={onNoteChange}
          onCancel={() => {
            restoreFocusAfterCancelRef.current = true;
            onCancelRespond();
          }}
          onReject={onReject}
          onApprove={onApprove}
        />
      )}
    </li>
  );
}
