"use client";

import type { SectionReviewView } from "@weeklyreport/shared";

import { isModifiedNavigation } from "../../../../shared/ui/feedback/modified-navigation";
import { ReviewCommentList } from "../../../../shared/ui/feedback/review-comment-list";
import {
  focusReviewRecord,
  reviewRecordAnchor,
} from "../../../../shared/ui/feedback/review-record-focus";
import type { LeadReviewFeedbackRecord } from "../../../report-sections";

const KIND_LABEL: Record<LeadReviewFeedbackRecord["kind"], string> = {
  item: "Item",
  risk: "Risk",
  decision: "Decision",
};

function FeedbackRecord({
  record,
}: {
  readonly record: LeadReviewFeedbackRecord;
}) {
  const anchor = reviewRecordAnchor(record.kind, record.id);
  return (
    <li className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-[0.09em] text-[var(--color-muted-foreground)]">
        {KIND_LABEL[record.kind]} &middot; {record.productName}
      </span>
      <a
        href={`#${anchor}`}
        data-testid="review-feedback-record-link"
        onClick={(event) => {
          if (isModifiedNavigation(event)) return;
          event.preventDefault();
          focusReviewRecord(anchor);
        }}
        className="flex min-h-[var(--touch-target-min)] min-w-0 items-center break-words rounded-[var(--radius-sm)] text-sm font-medium text-[var(--color-status-at-risk-fg)] underline underline-offset-4 hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] [overflow-wrap:anywhere]"
      >
        {record.text}
      </a>
      <ReviewCommentList comments={record.comments} />
    </li>
  );
}

// Lead-owned feedback is read-only: reviewers cannot compose/delete here, and
// an empty record list self-suppresses so no blank panel appears.
export function LeadReviewFeedback({
  records,
  reviews,
}: {
  readonly records: readonly LeadReviewFeedbackRecord[];
  readonly reviews: readonly SectionReviewView[];
}) {
  // Reasons recorded with a current changes request; legacy verdicts have none.
  const reasons = reviews.filter(
    (review) =>
      review.isCurrent &&
      review.verdict === "changes_requested" &&
      review.comment,
  );
  if (records.length === 0 && reasons.length === 0) return null;
  const total = records.reduce(
    (sum, record) => sum + record.comments.length,
    0,
  );
  const noun = total === 1 ? "note" : "notes";
  const hasRecords = records.length > 0;

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
        {hasRecords ? (
          <span className="text-sm font-semibold text-[var(--color-foreground)]">
            {total} reviewer {noun} on your records
          </span>
        ) : null}
      </header>
      {reasons.map((review) => (
        <div
          key={review.reviewerId}
          data-testid="section-review-reason"
          className="flex flex-col gap-1.5"
        >
          <span className="text-xs font-bold uppercase tracking-[0.09em] text-[var(--color-muted-foreground)]">
            Changes requested by {review.reviewerName ?? "the reviewer"}
          </span>
          <p className="min-w-0 whitespace-pre-wrap break-words text-[13px] font-medium text-[var(--color-foreground)] [overflow-wrap:anywhere]">
            {review.comment}
          </p>
        </div>
      ))}
      <ul className="flex flex-col gap-3">
        {records.map((record) => (
          <FeedbackRecord key={`${record.kind}-${record.id}`} record={record} />
        ))}
      </ul>
    </section>
  );
}
