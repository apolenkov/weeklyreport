"use client";

import { useEffect, useRef, useState } from "react";

import type { SectionReviewRow } from "../model/section-review-rows";
import { isSubmittedReviewableSection } from "../model/section-review-rows";
import { SectionVerdictControl } from "./section-verdict-control";

// A verdict that returns a section to its lead removes that row, taking the
// focused button with it. The band (tabIndex -1) is the stable place to land,
// but only when focus was lost: a refetch must not pull focus out of a
// comment box the reviewer is typing in.
function useFocusBandWhenRowRemoved(rowCount: number) {
  const bandRef = useRef<HTMLElement>(null);
  const previousCount = useRef(rowCount);
  useEffect(() => {
    const band = bandRef.current;
    const active = document.activeElement;
    const focusLost = !active || active === document.body;
    if (
      rowCount < previousCount.current &&
      (focusLost || band?.contains(active))
    ) {
      band?.focus();
    }
    previousCount.current = rowCount;
  }, [rowCount]);
  return bandRef;
}

// In-report section verdicts for designated reviewers; no publish/lock control
// (viewer-reviewers judge only). Self-suppresses when nothing is reviewable,
// but stays mounted after the last row is actioned so focus has a target.
export function ReviewVerdictBand({
  sections,
  onMutated,
}: {
  readonly sections: readonly SectionReviewRow[];
  readonly onMutated: () => void;
}) {
  const actionable = sections.filter(isSubmittedReviewableSection);
  const [hadRows, setHadRows] = useState(actionable.length > 0);
  if (actionable.length > 0 && !hadRows) setHadRows(true);
  const bandRef = useFocusBandWhenRowRemoved(actionable.length);
  if (actionable.length === 0 && !hadRows) return null;

  return (
    <section
      ref={bandRef}
      tabIndex={-1}
      aria-label="Section reviews"
      className="flex flex-col gap-1.5 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-muted-foreground)]">
        Review
      </span>
      {actionable.length === 0 ? (
        <p
          role="status"
          className="px-2.5 py-1.5 text-xs text-[var(--color-muted-foreground)]"
        >
          No submitted sections left to review.
        </p>
      ) : null}
      {actionable.map((section) => (
        <div
          key={section.reportSectionId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-sm)] bg-[var(--color-background)] px-2.5 py-1.5"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[13px] font-semibold text-[var(--color-foreground)]">
              {section.authorName}
            </span>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Submitted
            </span>
          </span>
          <SectionVerdictControl
            reportSectionId={section.reportSectionId}
            version={section.version}
            reviews={section.reviews}
            canReview
            subjectName={section.authorName}
            onMutated={onMutated}
          />
        </div>
      ))}
    </section>
  );
}
