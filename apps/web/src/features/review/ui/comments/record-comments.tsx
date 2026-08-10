"use client";

import type { RecordCommentView } from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { invalidateReview } from "../../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
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

function anchorId(anchor: RecordCommentAnchor): string | undefined {
  return anchor.itemId ?? anchor.riskId ?? anchor.decisionId;
}

function reviewErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function useRecordCommentMutations(
  anchor: RecordCommentAnchor,
  onCommentAdded: () => void,
  onMutated: () => void,
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
        toast.error(reviewErrorMessage(err, "Failed to add comment"));
      },
    }),
  );

  const deleteMut = useMutation(
    trpc.review.deleteComment.mutationOptions({
      onSuccess: () => {
        invalidateReview(qc, trpc);
        onMutated();
      },
      onError: (err: unknown) => {
        toast.error(reviewErrorMessage(err, "Failed to delete comment"));
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
}

function CommentComposerForm({
  draft,
  onDraftChange,
  onSubmit,
  submitDisabled,
  isPending,
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
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        aria-label="Add a review comment"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          className="btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-3 py-1 text-[12px] font-semibold text-[var(--color-primary-foreground)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          disabled={submitDisabled}
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
              aria-label="Delete comment"
            >
              Delete
            </button>
          ) : null
        }
      />
    </div>
  );
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
  const { submitComment, isCommentPending, deleteComment, isDeletePending } =
    useRecordCommentMutations(anchor, () => setDraft(""), onMutated);

  const id = anchorId(anchor);
  // A synthetic (non-persisted) record has no real UUID — the composer stays
  // hidden so a synthetic id can never reach the uuid-validated mutation.
  const canCompose = canReview && id !== undefined && UUID_RE.test(id);
  const hasComments = comments.length > 0;
  if (!hasComments && !canCompose) return null;

  const trimmed = draft.trim();
  const submitDisabled = trimmed.length === 0 || isCommentPending;

  return (
    // md+ indent matches the anchor row content column; below md keep a
    // minimal inset so the block stacks under the record on phones.
    <div className="mt-1.5 flex flex-col gap-2 pl-2 md:pl-[calc(20px+3px+124px+3.5rem)]">
      {hasComments ? (
        <RecordCommentThread
          comments={comments}
          canDelete={(comment) =>
            isAdmin || (canReview && comment.reviewerId === currentUserId)
          }
          onDelete={deleteComment}
          isDeletePending={isDeletePending}
        />
      ) : null}

      {canCompose ? (
        <CommentComposerForm
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={() => submitComment(trimmed)}
          submitDisabled={submitDisabled}
          isPending={isCommentPending}
        />
      ) : null}
    </div>
  );
}
