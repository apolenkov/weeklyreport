"use client";

import type { RecordCommentView } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { invalidateReview } from "../../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
import {
  CommentDeleteDialog,
  type CommentFeedback,
  CommentFeedbackMessage,
} from "./record-comment-feedback";
import { ReviewCommentList } from "./review-comment-list";

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
const COMMENT_EXCERPT_MAX_LENGTH = 60;
const COMMENT_EXCERPT_SUFFIX_LENGTH = 3;

function anchorId(anchor: RecordCommentAnchor): string | undefined {
  return anchor.itemId ?? anchor.riskId ?? anchor.decisionId;
}

function reviewErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function commentDeleteLabel(comment: RecordCommentView): string {
  const author = comment.reviewerName ?? "Reviewer";
  const excerpt = comment.text.replaceAll(/\s+/g, " ").trim();
  const shortened =
    excerpt.length > COMMENT_EXCERPT_MAX_LENGTH
      ? `${excerpt.slice(0, COMMENT_EXCERPT_MAX_LENGTH - COMMENT_EXCERPT_SUFFIX_LENGTH)}…`
      : excerpt;
  return shortened
    ? `Delete comment by ${author}: ${shortened}`
    : `Delete comment by ${author}`;
}

function useRecordCommentMutations(
  anchor: RecordCommentAnchor,
  onCommentAdded: () => void,
  onMutated: () => void,
  onCommentError: (err: unknown) => void,
  onDeleteSuccess: () => void,
  onDeleteError: (err: unknown) => void,
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

interface CommentComposerFormProps {
  readonly draft: string;
  readonly onDraftChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly submitDisabled: boolean;
  readonly isPending: boolean;
  readonly feedbackId?: string;
}

function CommentComposerForm({
  draft,
  onDraftChange,
  onSubmit,
  submitDisabled,
  isPending,
  feedbackId,
}: CommentComposerFormProps) {
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (submitDisabled) return;
        onSubmit();
      }}
    >
      <textarea
        className="min-h-[52px] w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5 text-[12.5px] text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)]"
        placeholder="Add a review comment…"
        name="review-comment"
        autoComplete="off"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        aria-label="Add a review comment"
        aria-describedby={feedbackId}
      />
      <div className="flex justify-end">
        <button
          type="submit"
          className="btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-3 py-1 text-[12px] font-semibold text-[var(--color-primary-foreground)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          disabled={submitDisabled}
          aria-busy={isPending || undefined}
        >
          {isPending ? "Adding…" : "Comment"}
        </button>
      </div>
    </form>
  );
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
      <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--color-muted-foreground)]">
        {comments.length} review {comments.length === 1 ? "note" : "notes"}
      </span>
      <ReviewCommentList
        comments={comments}
        renderAction={(comment) =>
          canDelete(comment) ? (
            <button
              type="button"
              className="inline-flex items-center justify-center max-md:min-h-[var(--touch-target-min)] max-md:min-w-[var(--touch-target-min)] text-[10px] font-semibold text-[var(--color-destructive)] underline-offset-2 hover:underline disabled:opacity-50"
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
  onMutated,
}: {
  readonly anchor: RecordCommentAnchor;
  readonly comments: readonly RecordCommentView[];
  readonly canReview: boolean;
  readonly currentUserId: string;
  readonly isAdmin: boolean;
  readonly onMutated: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<CommentFeedback | null>(null);
  const [deleteCandidate, setDeleteCandidate] =
    useState<RecordCommentView | null>(null);
  const id = anchorId(anchor);
  const feedbackId = `record-comment-feedback-${id ?? "unknown"}`;
  const { submitComment, isCommentPending, deleteComment, isDeletePending } =
    useRecordCommentMutations(
      anchor,
      () => {
        setDraft("");
        setFeedback({ message: "Comment added.", tone: "success" });
      },
      onMutated,
      (err) => {
        const message = reviewErrorMessage(err, "Failed to add comment");
        setFeedback({ message, tone: "error" });
        toast.error(message);
      },
      () => {
        setDeleteCandidate(null);
        setFeedback({ message: "Comment deleted.", tone: "success" });
      },
      (err) => {
        const message = reviewErrorMessage(err, "Failed to delete comment");
        setFeedback({ message, tone: "error" });
        toast.error(message);
      },
    );

  // A synthetic (non-persisted) record has no real UUID — the composer stays
  // hidden so a synthetic id can never reach the uuid-validated mutation.
  const canCompose = canReview && id !== undefined && UUID_RE.test(id);
  const hasComments = comments.length > 0;
  if (!hasComments && !canCompose) return null;

  const trimmed = draft.trim();
  const submitDisabled = trimmed.length === 0 || isCommentPending;

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
        <CommentComposerForm
          draft={draft}
          onDraftChange={(value) => {
            setDraft(value);
            setFeedback(null);
          }}
          onSubmit={() => submitComment(trimmed)}
          submitDisabled={submitDisabled}
          isPending={isCommentPending}
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
