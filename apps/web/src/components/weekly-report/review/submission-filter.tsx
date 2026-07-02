"use client";

import {
  segmentClassName,
  SegmentedToggle,
} from "../../report-shell/segmented-toggle";

/**
 * review-acknowledgement (§7): which sections the reviewer sees in the accordion
 * BODY. Per-user, client-only, default submitted-only. It filters the rendered
 * accordion only — never a server query, read gate, or group scope — so the
 * header submission count, the portfolio band, and the period nav keep showing
 * the truth (all sections).
 */
export type SubmissionFilter = "submitted" | "all";

const SEGMENTS: readonly { value: SubmissionFilter; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "all", label: "All" },
];

/** The [Submitted | All] toggle, in the shared neutral segmented-toggle family. */
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
          className={segmentClassName(value === segment.value)}
        >
          {segment.label}
        </button>
      ))}
    </SegmentedToggle>
  );
}

/**
 * review-acknowledgement (§7 anti-empty-state): when submitted-only hides draft
 * sections that DO carry content, this reveal affordance stands in for a
 * misleading empty accordion — it names the hidden count and flips the filter to
 * All, never the "No submissions yet" empty state.
 */
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
      data-testid="draft-hidden-signal"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] px-4 py-3"
    >
      <span className="text-sm text-[var(--color-muted-foreground)]">
        {count} {noun} in draft, hidden by the Submitted filter.
      </span>
      <button
        type="button"
        onClick={onShowAll}
        className="btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-3 py-1 text-[12px] font-semibold text-[var(--color-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)]"
      >
        Show all
      </button>
    </div>
  );
}
