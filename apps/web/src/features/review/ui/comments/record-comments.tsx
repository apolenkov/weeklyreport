"use client";

import { type RecordCommentView } from "@weeklyreport/shared";

import { shortItemLabel } from "../../../../shared/lib/format/short-label";
import { ReviewCommentList } from "../../../../shared/ui/feedback/review-comment-list";
import { RecordCommentComposer } from "./record-comment-composer";
import {
  CommentDeleteDialog,
  CommentFeedbackMessage,
} from "./record-comment-feedback";
import {
  type RecordCommentAnchor,
  useRecordCommentState,
} from "./use-record-comment-state";

export type { RecordCommentAnchor };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function commentDeleteLabel(comment: RecordCommentView): string {
  const author = comment.reviewerName ?? "Reviewer";
  const shortened = shortItemLabel(comment.text);
  return shortened
    ? `Delete comment by ${author}: ${shortened}`
    : `Delete comment by ${author}`;
}

// Subject-specific accessible names keep repeated composers distinguishable.
function composerLabels(subject: string | undefined) {
  if (!subject) return {};
  const excerpt = shortItemLabel(subject);
  return {
    label: `Add a review comment on ${excerpt}`,
    submitLabel: `Comment on ${excerpt}`,
  };
}

interface RecordCommentThreadProps {
  readonly comments: readonly RecordCommentView[];
  // Self-delete needs current canReview (no dead affordance after revoke);
  // admin deletes anywhere.
  readonly canDelete: (comment: RecordCommentView) => boolean;
  readonly onDelete: (commentId: string) => void;
  readonly isDeletePending: boolean;
}

function RecordCommentThread({
  comments,
  canDelete,
  onDelete,
  isDeletePending,
}: RecordCommentThreadProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-[0.09em] text-[var(--color-muted-foreground)]">
        {comments.length} review {comments.length === 1 ? "note" : "notes"}
      </span>
      <ReviewCommentList
        comments={comments}
        renderAction={(comment) =>
          canDelete(comment) ? (
            <button
              type="button"
              className="inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)] text-xs font-semibold text-[var(--color-destructive)] underline-offset-2 hover:underline disabled:opacity-50"
              onClick={() => onDelete(comment.id)}
              disabled={isDeletePending}
              aria-busy={isDeletePending || undefined}
              aria-label={commentDeleteLabel(comment)}
            >
              Delete
            </button>
          ) : null
        }
      />
    </div>
  );
}

function canDeleteComment(
  comment: RecordCommentView,
  canReview: boolean,
  currentUserId: string,
  isAdmin: boolean,
): boolean {
  return isAdmin || (canReview && comment.reviewerId === currentUserId);
}

// Designated-reviewer comments on one record; canReview is the affordance gate
// only — the mutation re-derives group server-side (never the security boundary).
export function RecordComments({
  anchor,
  comments,
  canReview,
  currentUserId,
  isAdmin,
  subject,
  onMutated,
}: {
  readonly anchor: RecordCommentAnchor;
  readonly comments: readonly RecordCommentView[];
  readonly canReview: boolean;
  readonly currentUserId: string;
  readonly isAdmin: boolean;
  /** Record text; makes each composer's accessible name unique in a list. */
  readonly subject?: string | undefined;
  readonly onMutated: () => void;
}) {
  const c = useRecordCommentState(anchor, onMutated);
  const { id, feedback, feedbackId, deleteCandidate } = c;

  // An idle confirmation is retired once its comment leaves the list or the
  // actor may no longer delete it; an in-flight delete keeps its dialog until
  // it settles. The server still decides every delete.
  if (
    deleteCandidate &&
    !c.isDeletePending &&
    !comments.some(
      (comment) =>
        comment.id === deleteCandidate.id &&
        canDeleteComment(comment, canReview, currentUserId, isAdmin),
    )
  )
    c.setDeleteCandidate(null);

  // A synthetic (non-persisted) record has no real UUID — the composer stays
  // hidden so a synthetic id can never reach the uuid-validated mutation.
  const canCompose = canReview && id !== undefined && UUID_RE.test(id);
  const hasComments = comments.length > 0;
  if (!hasComments && !canCompose) return null;

  const requestDelete = (commentId: string) => {
    c.setDeleteCandidate(
      comments.find((candidate) => candidate.id === commentId) ?? null,
    );
  };

  return (
    // md+ indent matches the anchor row content column; below md keep a
    // minimal inset so the block stacks under the record on phones.
    <div className="mt-1.5 flex flex-col gap-2 pl-2 md:pl-[calc(20px+3px+124px+3.5rem)]">
      {hasComments ? (
        <RecordCommentThread
          comments={comments}
          canDelete={(comment) =>
            canDeleteComment(comment, canReview, currentUserId, isAdmin)
          }
          onDelete={requestDelete}
          isDeletePending={c.isDeletePending}
        />
      ) : null}

      <CommentFeedbackMessage feedback={feedback} id={feedbackId} />

      {canCompose ? (
        <RecordCommentComposer
          draft={c.draft}
          characterCount={c.characterCount}
          onDraftChange={c.changeDraft}
          onSubmit={c.submitDraft}
          submitDisabled={c.submitDisabled}
          isPending={c.isCommentPending}
          {...composerLabels(subject)}
          validationError={c.validationError}
          {...(feedback ? { feedbackId } : {})}
        />
      ) : null}

      <CommentDeleteDialog
        candidate={deleteCandidate}
        isPending={c.isDeletePending}
        onConfirm={c.deleteComment}
        onCancel={() => c.setDeleteCandidate(null)}
      />
    </div>
  );
}
