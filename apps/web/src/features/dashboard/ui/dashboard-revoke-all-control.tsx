"use client";

import type { WeeklyReportReadModel } from "@customreport/shared";
import { useState } from "react";

import { ConfirmationDialog } from "../../../shared/ui/dialogs/confirmation-dialog";

interface DashboardRevokeAllControlProps {
  readonly pending: boolean;
  readonly report?: WeeklyReportReadModel | undefined;
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
  // Explicit button disclosure: <details>/<summary> reads as a false affordance
  // to tooling and carries no aria-expanded state for screen readers.
  const [expanded, setExpanded] = useState(false);
  return (
    <section
      aria-label="Bulk actions"
      className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="bulk-actions-panel"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex min-h-8 items-center gap-1.5 text-xs font-semibold text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)]"
      >
        <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
        Bulk actions
      </button>
      {expanded ? (
        <div
          id="bulk-actions-panel"
          className="mt-3 flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Destructive actions affect every submitted lead.
          </p>
          <button
            type="button"
            onClick={onOpen}
            disabled={pending}
            data-testid="revoke-all-button"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center rounded-[var(--radius-pill)] border border-[color-mix(in_srgb,var(--color-destructive)_40%,transparent)] px-4 text-sm font-semibold text-[var(--color-destructive)] hover:bg-[var(--color-status-blocked-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-destructive)] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            Revoke all ({submittedCount})
          </button>
        </div>
      ) : null}
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
        title="Revoke all submissions?"
        description={`Revoke all ${submittedCount} submitted lead${submittedCount === 1 ? "" : "s"}? Their forms return to Draft status.`}
        confirmLabel={`Revoke ${submittedCount} submission${submittedCount === 1 ? "" : "s"}`}
        variant="destructive"
      />
    </>
  );
}
