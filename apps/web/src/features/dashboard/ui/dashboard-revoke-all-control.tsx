"use client";

import type { WeeklyReportReadModel } from "@customreport/shared";
import { useState } from "react";

import { ConfirmationDialog } from "../../../shared/ui/confirmation-dialog";

interface DashboardRevokeAllControlProps {
  readonly pending: boolean;
  readonly report?: WeeklyReportReadModel;
  readonly submittedCount: number;
  readonly onRevokeAll: (reportId: string) => void;
}

export function DashboardRevokeAllControl({
  pending,
  report,
  submittedCount,
  onRevokeAll,
}: DashboardRevokeAllControlProps) {
  const [open, setOpen] = useState(false);
  const canRevoke = Boolean(
    report && report.periodStatus !== "published" && submittedCount > 0,
  );
  if (!canRevoke || !report) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        data-testid="revoke-all-button"
        className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center rounded-[var(--radius-pill)] border border-red-300 px-4 text-sm font-semibold text-red-600 disabled:opacity-60"
      >
        Revoke All ({submittedCount})
      </button>
      <ConfirmationDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onRevokeAll(report.reportId);
        }}
        title="Revoke All Submissions?"
        description={`Revoke all ${submittedCount} submitted lead${submittedCount === 1 ? "" : "s"}? Their forms return to Draft status.`}
        confirmLabel={`Revoke ${submittedCount} Submission${submittedCount === 1 ? "" : "s"}`}
        variant="revoke"
      />
    </>
  );
}
