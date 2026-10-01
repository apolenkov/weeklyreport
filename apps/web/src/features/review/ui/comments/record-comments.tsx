"use client";

import {
  type RecordCommentView,
  REVIEW_COMMENT_MAX_LENGTH,
  reviewCommentInputSchema,
} from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { shortItemLabel } from "../../../../shared/lib/format/short-label";
import { invalidateReview } from "../../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
import { ReviewCommentList } from "../../../../shared/ui/feedback/review-comment-list";
import { RecordCommentComposer } from "./record-comment-composer";
import {
  CommentDeleteDialog,
  type CommentFeedback,
  CommentFeedbackMessage,
} from "./record-comment-feedback";

// Exactly one concrete record anchors each comment.
export type RecordCommentAnchor =
  | {
      readonly itemId: string;
      readonly riskId?: never;
      readonly decisionId?: never;
    }
  | {
      readonly riskId: string;
      readonly itemId?: never;
      readonly decisionId?: never;
    }
  | {
      readonly decisionId: string;
      readonly itemId?: never;
      readonly riskId?: never;
    };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function anchorId(anchor: RecordCommentAnchor): string | undefined {
  return anchor.itemId ?? anchor.riskId ?? anchor.decisionId;
}

function reviewErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error) || !err.message) return fallback;
  try {
    const parsed: unknown = JSON.parse(err.message);
    if (Array.isArray(parsed)) {
      return "Comment could not be saved. Check its content and try again.";
    }
  } catch {
    // Ordinary error messages remain useful to the reviewer.
  }
  return err.message;
}

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

function commentValidationError(
  draft: string,
  validationSucceeded: boolean,
  validationAttempted: boolean,
): string | undefined {
  if (validationSucceeded || (draft.length === 0 && !validationAttempted)) {
    return undefined;
  }
  return draft.length > REVIEW_COMMENT_MAX_LENGTH
    ? `Comment must be ${REVIEW_COMMENT_MAX_LENGTH} characters or fewer.`
    : "Comment must contain visible characters.";
}

interface RecordCommentMutationCallbacks {
  readonly onCommentAdded: () => void;
  readonly onMutated: () => void;
  readonly onCommentError: (err: unknown) => void;
  readonly onDeleteSuccess: () => void;
  readonly onDeleteError: (err: unknown) => void;
}

function useRecordCommentMutations(
  anchor: RecordCommentAnchor,
  {
    onCommentAdded,
    onMutated,
    onCommentError,
    onDeleteSuccess,
    onDeleteError,
  }: RecordCommentMutationCallbacks,
) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const commentMut = useMutation(
    trpc.review.comment.mutationOptions({
      onSuccess: () => {
        onCommentAdded();
        invalidateReview(qc, trpc);
        onMutated();
      },
      onError: (err: unknown) => {
        onCommentError(err);
      },
    }),
  );

  const deleteMut = useMutation(
    trpc.review.deleteComment.mutationOptions({
      onSuccess: () => {
        invalidateReview(qc, trpc);
        onMutated();
        onDeleteSuccess();
      },
      onError: (err: unknown) => {
        onDeleteError(err);
      },
    }),
  );

  return {
    submitComment: (text: string) => commentMut.mutate({ ...anchor, text }),
    isCommentPending: commentMut.isPending,
    deleteComment: (commentId: string) => deleteMut.mutate({ commentId }),
    isDeletePending: deleteMut.isPending,
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
  const [draft, setDraft] = useState("");
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [feedback, setFeedback] = useState<CommentFeedback | null>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<RecordCommentView | null>(null);
  const id = anchorId(anchor);
  const feedbackId = `record-comment-feedback-${id ?? "unknown"}`;
  const { submitComment, isCommentPending, deleteComment, isDeletePending } =
    useRecordCommentMutations(anchor, {
      onCommentAdded: () => {
        setDraft("");
        setValidationAttempted(false);
        setFeedback({ message: "Comment added.", tone: "success" });
      },
      onMutated,
      onCommentError: (err) => {
        const message = reviewErrorMessage(err, "Failed to add comment");
        setFeedback({ message, tone: "error" });
        toast.error(message);
      },
      onDeleteSuccess: () => {
        setDeleteCandidate(null);
        setFeedback({ message: "Comment deleted.", tone: "success" });
      },
      onDeleteError: (err) => {
        const message = reviewErrorMessage(err, "Failed to delete comment");
        setFeedback({ message, tone: "error" });
        toast.error(message);
      },
    });

  // A synthetic (non-persisted) record has no real UUID — the composer stays
  // hidden so a synthetic id can never reach the uuid-validated mutation.
  const canCompose = canReview && id !== undefined && UUID_RE.test(id);
  const hasComments = comments.length > 0;
  if (!hasComments && !canCompose) return null;

  const validationResult = reviewCommentInputSchema.safeParse({
    ...anchor,
    text: draft,
  });
  const validationError = commentValidationError(
    draft,
    validationResult.success,
    validationAttempted,
  );
  const submitDisabled = !validationResult.success || isCommentPending;

  const submitDraft = () => {
    setValidationAttempted(true);
    const currentResult = reviewCommentInputSchema.safeParse({
      ...anchor,
      text: draft,
    });
    if (!currentResult.success || isCommentPending) return;
    submitComment(currentResult.data.text.trim());
  };

  const requestDelete = (commentId: string) => {
    setDeleteCandidate(
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
          isDeletePending={isDeletePending}
        />
      ) : null}

      <CommentFeedbackMessage feedback={feedback} id={feedbackId} />

      {canCompose ? (
        <RecordCommentComposer
          draft={draft}
          onDraftChange={(value) => {
            setDraft(value);
            setValidationAttempted(false);
            setFeedback(null);
          }}
          onSubmit={submitDraft}
          submitDisabled={submitDisabled}
          isPending={isCommentPending}
          {...composerLabels(subject)}
          validationError={validationError}
          {...(feedback ? { feedbackId } : {})}
        />
      ) : null}

      <CommentDeleteDialog
        candidate={deleteCandidate}
        isPending={isDeletePending}
        onConfirm={deleteComment}
        onCancel={() => setDeleteCandidate(null)}
      />
    </div>
  );
}
