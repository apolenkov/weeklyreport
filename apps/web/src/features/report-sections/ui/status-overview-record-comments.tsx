"use client";

import type { RecordCommentView } from "@customreport/shared";

import { ReviewCommentList } from "../../../shared/ui/feedback/review-comment-list";
import type { StatusOverviewItem } from "../model/status-overview";

/**
 * Reviewer comments on one tracked-work record inside the Overview details.
 * The lead surface is read-only by design: reviewers compose, the lead reads,
 * so this mounts the shared comment stack without a composer and self-suppresses
 * when the record carries no comments.
 */
export function TrackedWorkComments({
  item,
}: {
  readonly item: StatusOverviewItem;
}) {
  const comments: readonly RecordCommentView[] = item.comments;
  if (comments.length === 0) return null;
  return (
    <div
      data-testid={`tracked-work-comments-${item.key}`}
      className="flex flex-col gap-1.5"
    >
      <span className="text-xs font-bold uppercase tracking-[0.09em] text-[var(--color-muted-foreground)]">
        Reviewer comments
      </span>
      <ReviewCommentList comments={comments} />
    </div>
  );
}
