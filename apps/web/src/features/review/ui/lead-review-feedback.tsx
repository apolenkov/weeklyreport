"use client";

import { ReviewCommentList } from "../../../shared/ui/review-comment-list";
import type { LeadReviewFeedbackRecord } from "../../report-sections";

const KIND_LABEL: Record<LeadReviewFeedbackRecord["kind"], string> = {
  item: "Item",
  risk: "Risk",
  decision: "Decision",
};

/**
 * review-acknowledgement (§8): read-only reviewer-feedback panel on the lead's
 * OWN form. When a returned (draft) section carries reviewer comments, it surfaces
 * them grouped under each anchor record — with a loud section-level count marker
 * so the return is never silent. It reuses {@link ReviewCommentList}; the lead has
 * no review capability, so the panel is strictly display-only (no composer, no
 * delete). Self-suppresses when there is nothing to show.
  * @param options - The options argument.
 */
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
      className="flex flex-col gap-3 rounded-[var(--radius)] border border-amber-200 bg-amber-50 p-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
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
