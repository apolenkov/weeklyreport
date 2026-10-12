import type { RecordCommentView } from "@weeklyreport/shared";
import type { ReactNode } from "react";

import type { AccordionReviewContext } from "../../model/report-review-model";
import type { RecordCommentAnchor } from "./record-comments";
import { RecordComments } from "./record-comments";

export function ReviewedRow({
  review,
  anchor,
  record,
  children,
}: {
  readonly review: AccordionReviewContext | undefined;
  readonly anchor: RecordCommentAnchor;
  readonly record: {
    readonly text?: string;
    readonly comments?: readonly RecordCommentView[];
    readonly canReview?: boolean;
  };
  readonly children: ReactNode;
}) {
  // Mount comment controls only when comments exist or the record is reviewable.
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
          subject={record.text}
          onMutated={review.onMutated}
        />
      ) : null}
    </>
  );
}
