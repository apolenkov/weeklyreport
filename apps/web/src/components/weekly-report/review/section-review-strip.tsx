"use client";

import type {
  ReportSectionReadModel,
  SectionReviewView,
} from "@customreport/shared";

import { SectionVerdictControl } from "./section-verdict-control";

/** One rendered section's review state for the strip. */
export interface SectionReviewRow {
  readonly reportSectionId: string;
  readonly version: number;
  readonly authorName: string;
  readonly status: ReportSectionReadModel["status"];
  readonly reviews: readonly SectionReviewView[];
  readonly canReview: boolean;
  readonly groupId: string | null;
}

function statusLabel(status: ReportSectionReadModel["status"]): string {
  return status === "submitted" ? "Submitted" : "Draft";
}

/**
 * review-acknowledgement (§6.3): a scope-independent per-section review band
 * rendered once above the accordion body on the live (non-published) period.
 * One compact row per section carries the author, submission status, and the
 * verdict control. Chosen over a by-lead group header because the head default
 * scope is by-product AND the viewer surface is product-only, so the verdict
 * needs a home present in both. It NEVER renders a publish/lock control.
 *
 * Only rows the caller can act on OR that already carry a verdict render, so a
 * plain viewer with no review capability sees an empty (unrendered) band rather
 * than a wall of "Not reviewed".
 */
export function SectionReviewStrip({
  sections,
  onMutated,
}: {
  readonly sections: readonly SectionReviewRow[];
  readonly onMutated: () => void;
}) {
  const relevant = sections.filter(
    (section) => section.canReview || section.reviews.length > 0,
  );
  if (relevant.length === 0) return null;

  return (
    <section
      aria-label="Section reviews"
      className="flex flex-col gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3"
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
        Review
      </span>
      {relevant.map((section) => (
        <div
          key={section.reportSectionId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--color-background)] px-2.5 py-1.5"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-[var(--color-foreground)]">
              {section.authorName}
            </span>
            <span className="text-[11px] text-[var(--color-muted-foreground)]">
              {statusLabel(section.status)}
            </span>
          </span>
          <SectionVerdictControl
            reportSectionId={section.reportSectionId}
            version={section.version}
            reviews={section.reviews}
            canReview={section.canReview}
            onMutated={onMutated}
          />
        </div>
      ))}
    </section>
  );
}
