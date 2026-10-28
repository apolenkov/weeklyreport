"use client";

import {
  segmentClassName,
  SegmentedToggle,
} from "../../../shared/ui/report-shell/segmented-toggle";

// Client-only accordion body filter (default submitted-only). Never a server
// query or read gate — header counts and portfolio still show all sections.
export type SubmissionFilter = "submitted" | "all";

const SEGMENTS: readonly { value: SubmissionFilter; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "all", label: "All" },
];

export function SubmissionFilterToggle({
  value,
  onChange,
}: {
  readonly value: SubmissionFilter;
  readonly onChange: (next: SubmissionFilter) => void;
}) {
  return (
    <SegmentedToggle ariaLabel="Section filter">
      {SEGMENTS.map((segment) => (
        <button
          key={segment.value}
          type="button"
          aria-pressed={value === segment.value}
          onClick={() => onChange(segment.value)}
          className={`${segmentClassName(value === segment.value)} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1`}
        >
          {segment.label}
        </button>
      ))}
    </SegmentedToggle>
  );
}

// Reveal when submitted-only hides draft sections that have content — avoids
// a misleading empty accordion ("No submissions yet").
export function DraftHiddenSignal({
  count,
  onShowAll,
}: {
  readonly count: number;
  readonly onShowAll: () => void;
}) {
  const noun = count === 1 ? "section" : "sections";
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="draft-hidden-signal"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] px-4 py-3"
    >
      <span className="text-sm text-[var(--color-muted-foreground)]">
        {count} {noun} in draft, hidden by the Submitted filter.
      </span>
      <button
        type="button"
        aria-label="Show all sections including drafts"
        onClick={onShowAll}
        className="btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-3 py-1 text-[12px] font-semibold text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2"
      >
        Show all
      </button>
    </div>
  );
}
