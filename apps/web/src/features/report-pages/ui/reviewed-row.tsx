import type { RecordCommentView } from "@customreport/shared";
import type { ReactNode } from "react";

import type { RecordCommentAnchor } from "../../review";
import { RecordComments } from "../../review";

/**
 * The in-app reviewer context threaded from the page.
 * Present ONLY on the live head/viewer surface — the print/PDF path renders the
 * accordion WITHOUT it, so no reviewer notes or composer leak into an export.
 */
export interface AccordionReviewContext {
  readonly currentUserId: string;
  readonly isAdmin: boolean;
  readonly onMutated: () => void;
}

/**
 * Wraps a content row so its reviewer comments (and, for a designated reviewer,
 * the composer) stack directly under the anchor row. A no-op when `review` is
 * absent (print/PDF) or the record has nothing to show — {@link RecordComments}
 * self-suppresses, so the row layout is unchanged for non-reviewers.
 * @param options - The options argument.
 */
export function ReviewedRow({
  review,
  anchor,
  record,
  children,
}: {
  readonly review: AccordionReviewContext | undefined;
  readonly anchor: RecordCommentAnchor;
  readonly record: { comments?: RecordCommentView[]; canReview?: boolean };
  readonly children: ReactNode;
}) {
  // Mount the comments block ONLY when there is something to show — existing
  // comments or a review capability. This keeps the review data-layer (its
  // tRPC hooks) out of every non-reviewer render, so the print/PDF path and a
  // plain read never pull it in.
  const hasReviewContent =
    (record.comments?.length ?? 0) > 0 || (record.canReview ?? false);
  return (
    <>
      {children}
      {review && hasReviewContent ? (
        <RecordComments
          anchor={anchor}
          comments={record.comments ?? []}
          canReview={record.canReview ?? false}
          currentUserId={review.currentUserId}
          isAdmin={review.isAdmin}
          onMutated={review.onMutated}
        />
      ) : null}
    </>
  );
}
