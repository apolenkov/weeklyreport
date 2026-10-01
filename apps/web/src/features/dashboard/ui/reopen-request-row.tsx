"use client";

import { shortNameFromName } from "@customreport/shared";
import { type RefObject, useEffect, useRef } from "react";

import {
  formatDateTime,
  formatPeriodRangeWithYear,
  joinPeriodLabel,
} from "../../../shared/lib/format/format-date";
import { ReopenRespondForm } from "../../../shared/ui/forms/reopen-respond-form";

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
  isPending,
  onStartRespond,
  triggerRef,
}: {
  readonly request: DashboardReopenRequest;
  readonly isResponding: boolean;
  readonly isPending: boolean;
  readonly onStartRespond: () => void;
  readonly triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-foreground)]">
            {shortNameFromName(r.requestedBy.name)}
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
          ref={triggerRef}
          type="button"
          disabled={isPending}
          onClick={onStartRespond}
          className="btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
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
  const respondButtonRef = useRef<HTMLButtonElement>(null);
  const responseFieldRef = useRef<HTMLTextAreaElement>(null);
  const restoreFocusAfterCancelRef = useRef(false);

  useEffect(() => {
    if (isResponding) {
      responseFieldRef.current?.focus();
      return;
    }

    if (restoreFocusAfterCancelRef.current) {
      restoreFocusAfterCancelRef.current = false;
      respondButtonRef.current?.focus();
    }
  }, [isResponding]);

  return (
    <li className="rounded-[var(--radius)] border border-[var(--color-border)] p-3">
      <ReopenRequestHeader
        request={r}
        isResponding={isResponding}
        isPending={isPending}
        onStartRespond={onStartRespond}
        triggerRef={respondButtonRef}
      />

      {r.reason && (
        <div className="mt-2 rounded-[var(--radius)] bg-[var(--color-surface-hover)] p-2 text-sm text-[var(--color-foreground)]">
          <span className="whitespace-pre-wrap">{r.reason}</span>
        </div>
      )}

      {isResponding && (
        <ReopenRespondForm
          requestId={r.id}
          note={note}
          textareaRef={responseFieldRef}
          onNoteChange={onNoteChange}
          onCancel={() => {
            restoreFocusAfterCancelRef.current = true;
            onCancel();
          }}
          onReject={onReject}
          onApprove={onApprove}
          isPending={isPending}
          pendingDecision={pendingDecision}
        />
      )}
    </li>
  );
}
