"use client";

import { ReviewCommentList } from "../../../shared/ui/review-comment-list";
import type { LeadReviewFeedbackRecord } from "../../report-sections";

const KIND_LABEL: Record<LeadReviewFeedbackRecord["kind"], string> = {
  item: "Item",
  risk: "Risk",
  decision: "Decision",
};

// Lead-owned feedback is read-only: reviewers cannot compose/delete here, and
// an empty record list self-suppresses so no blank panel appears.
export function LeadReviewFeedback({
  records,
}: {
  readonly records: readonly LeadReviewFeedbackRecord[];
}) {
  if (records.length === 0) return null;
  const total = records.reduce(
    (sum, record) => sum + record.comments.length,
    0,
  );
  const noun = total === 1 ? "note" : "notes";

  return (
    <section
      aria-label="Reviewer feedback"
      data-testid="lead-review-feedback"
      className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--color-status-at-risk-border)] bg-[var(--color-status-at-risk-bg)] p-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-status-at-risk-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-status-at-risk-fg)]">
          Reviewer feedback
        </span>
        {/* Copy stays verdict-neutral: comments can exist pre-verdict on a
            still-submitted section, so the marker must not assert a
            resubmission that was never requested. */}
        <span className="text-sm font-semibold text-[var(--color-foreground)]">
          {total} reviewer {noun} on your records
        </span>
      </header>
      <ul className="flex flex-col gap-3">
        {records.map((record) => (
          <li
            key={`${record.kind}-${record.id}`}
            className="flex flex-col gap-1.5"
          >
            <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--color-muted-foreground)]">
              {KIND_LABEL[record.kind]} &middot; {record.productName}
            </span>
            <span className="text-[13px] font-medium text-[var(--color-foreground)]">
              {record.text}
            </span>
            <ReviewCommentList comments={record.comments} />
          </li>
        ))}
      </ul>
    </section>
  );
}
