"use client";

import { ReviewCommentList } from "../../../shared/ui/feedback/review-comment-list";
import type { CommentsViewProps } from "../model/contextual-entry-contract";

export function StatusOverviewCommentsView({
  id,
  itemLabel,
  comments,
  onClose,
}: CommentsViewProps) {
  return (
    <section
      id={id}
      aria-label={`Comments for ${itemLabel}`}
      className="flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.09em] text-[var(--color-muted-foreground)]">
          Comments
        </span>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-2 text-xs text-[var(--color-foreground)]"
        >
          Close comments
        </button>
      </div>
      {comments.length === 0 ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          No comments yet.
        </p>
      ) : (
        <ReviewCommentList comments={comments} />
      )}
    </section>
  );
}
