"use client";

import type { LeadSubmitReadiness } from "../../report-sections";
import { autosaveReadinessCopy } from "./autosave-state-copy";

interface LeadSubmitReadinessSummaryProps {
  readonly readiness: LeadSubmitReadiness;
  readonly onSubmit: () => void;
}

function ReadinessHeader({
  readiness,
  onSubmit,
}: LeadSubmitReadinessSummaryProps) {
  const ready = readiness.blockingIssues.length === 0;
  return (
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
          {autosaveReadinessCopy(readiness.autosaveState)}
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
  );
}

function ReadinessGroup({
  title,
  items,
  blocked = false,
}: {
  readonly title: string;
  readonly items: readonly { readonly id: string; readonly label: string }[];
  readonly blocked?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <h3
        className={`text-sm font-semibold ${blocked ? "text-[var(--color-destructive)]" : "text-[var(--color-foreground)]"}`}
      >
        {title}
      </h3>
      <ul
        className={`mt-1 list-disc space-y-1 pl-5 text-sm ${blocked ? "text-[var(--color-foreground)]" : "text-[var(--color-muted-foreground)]"}`}
      >
        {items.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Lead Submit Readiness Summary.
 * @param props - The props argument.
 */
export function LeadSubmitReadinessSummary({
  readiness,
  onSubmit,
}: LeadSubmitReadinessSummaryProps) {
  return (
    <section
      aria-labelledby="lead-submit-readiness-title"
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white p-5 shadow-sm"
      data-testid="lead-submit-readiness"
    >
      <ReadinessHeader readiness={readiness} onSubmit={onSubmit} />
      <ReadinessGroup
        title="Will be set to On Track"
        items={readiness.willAutoPromote}
      />
      <ReadinessGroup
        title="Blocks submission"
        items={readiness.blockingIssues}
        blocked
      />
    </section>
  );
}
