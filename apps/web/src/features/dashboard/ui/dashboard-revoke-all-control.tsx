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

function BulkRevokeSection({
  pending,
  submittedCount,
  onOpen,
}: {
  readonly pending: boolean;
  readonly submittedCount: number;
  readonly onOpen: () => void;
}) {
  return (
    <section
      aria-label="Bulk actions"
      className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
    >
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)]">
          Bulk actions
        </summary>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Destructive actions affect every submitted lead.
          </p>
          <button
            type="button"
            onClick={onOpen}
            disabled={pending}
            data-testid="revoke-all-button"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-red-300 px-4 text-sm font-semibold text-red-600 disabled:opacity-60"
          >
            Revoke All ({submittedCount})
          </button>
        </div>
      </details>
    </section>
  );
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
      <BulkRevokeSection
        pending={pending}
        submittedCount={submittedCount}
        onOpen={() => setOpen(true)}
      />
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
