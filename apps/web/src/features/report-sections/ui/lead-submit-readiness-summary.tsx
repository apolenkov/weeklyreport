"use client";

import type { LeadSubmitReadiness } from "../model/lead-submit-readiness";

interface LeadSubmitReadinessSummaryProps {
  readonly readiness: LeadSubmitReadiness;
  readonly onSubmit: () => void;
}

const autosaveCopy: Record<LeadSubmitReadiness["autosaveState"], string> = {
  idle: "Draft is saved.",
  pending: "Draft changes are waiting to save.",
  saving: "Draft changes are saving.",
  saved: "Draft is saved.",
  error: "Draft save failed. Use Save to retry.",
};

export function LeadSubmitReadinessSummary({
  readiness,
  onSubmit,
}: LeadSubmitReadinessSummaryProps) {
  const ready = readiness.blockingIssues.length === 0;
  return (
    <section
      aria-labelledby="lead-submit-readiness-title"
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-5 shadow-sm"
      data-testid="lead-submit-readiness"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="lead-submit-readiness-title"
            className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]"
          >
            Submit readiness
          </h2>
          <p className="mt-1 text-sm font-semibold" role="status">
            {ready ? "Ready" : "Needs attention"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {autosaveCopy[readiness.autosaveState]}
          </p>
        </div>
        <button
          type="button"
          aria-label="Submit report"
          className="btn-press inline-flex min-h-10 items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-5 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSubmit}
          disabled={!readiness.canOpenConfirmation}
          title={readiness.blockingIssues[0]?.label}
        >
          Submit
        </button>
      </div>

      {readiness.willAutoPromote.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-[var(--color-foreground)]">
            Will be set to On Track
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted-foreground)]">
            {readiness.willAutoPromote.map((status) => (
              <li key={status.id}>{status.label}</li>
            ))}
          </ul>
        </div>
      )}

      {readiness.blockingIssues.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-[var(--color-destructive)]">
            Blocks submission
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-foreground)]">
            {readiness.blockingIssues.map((issue) => (
              <li key={issue.id}>{issue.label}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
