import type { RecordCommentView } from "@customreport/shared";
import type { ReactNode } from "react";

import type { RecordCommentAnchor } from "../../review";
import { RecordComments } from "../../review";

// Live review surfaces supply this context; print/PDF omits it so reviewer UI
// cannot leak into exports.
export interface AccordionReviewContext {
  readonly currentUserId: string;
  readonly isAdmin: boolean;
  readonly onMutated: () => void;
}

export function ReviewedRow({
  review,
  anchor,
  record,
  children,
}: {
  readonly review: AccordionReviewContext | undefined;
  readonly anchor: RecordCommentAnchor;
  readonly record: {
    readonly comments?: readonly RecordCommentView[];
    readonly canReview?: boolean;
  };
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
