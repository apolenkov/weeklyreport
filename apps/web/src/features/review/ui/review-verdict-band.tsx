"use client";

import type { SectionReviewRow } from "../model/section-review-rows";
import { isSubmittedReviewableSection } from "../model/section-review-rows";
import { SectionVerdictControl } from "./section-verdict-control";

// In-report section verdicts for designated reviewers; no publish/lock control
// (viewer-reviewers judge only). Self-suppresses when nothing is reviewable.
export function ReviewVerdictBand({
  sections,
  onMutated,
}: {
  readonly sections: readonly SectionReviewRow[];
  readonly onMutated: () => void;
}) {
  const actionable = sections.filter(isSubmittedReviewableSection);
  if (actionable.length === 0) return null;

  return (
    <section
      aria-label="Section reviews"
      className="flex flex-col gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3"
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
        Review
      </span>
      {actionable.map((section) => (
        <div
          key={section.reportSectionId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--color-background)] px-2.5 py-1.5"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-[var(--color-foreground)]">
              {section.authorName}
            </span>
            <span className="text-[11px] text-[var(--color-muted-foreground)]">
              Submitted
            </span>
          </span>
          <SectionVerdictControl
            reportSectionId={section.reportSectionId}
            version={section.version}
            reviews={section.reviews}
            canReview
            onMutated={onMutated}
          />
        </div>
      ))}
    </section>
  );
}
