import {
  type RecordCommentView,
  REVIEW_COMMENT_MAX_LENGTH,
  reviewCommentInputSchema,
} from "@customreport/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { invalidateReview } from "../../../../shared/lib/query/cache-keys";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
import type { CommentFeedback } from "./record-comment-feedback";

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

function commentValidationError(
  draft: string,
  validationSucceeded: boolean,
  validationAttempted: boolean,
): string | undefined {
  if (validationSucceeded || (draft.length === 0 && !validationAttempted)) {
    return undefined;
  }
  return Array.from(draft).length > REVIEW_COMMENT_MAX_LENGTH
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

export function useRecordCommentState(
  anchor: RecordCommentAnchor,
  onMutated: () => void,
) {
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

  const changeDraft = (value: string) => {
    setDraft(value);
    setValidationAttempted(false);
    setFeedback(null);
  };

  return {
    draft,
    changeDraft,
    submitDraft,
    submitDisabled,
    validationError,
    feedback,
    deleteCandidate,
    setDeleteCandidate,
    id,
    feedbackId,
    isCommentPending,
    deleteComment,
    isDeletePending,
  };
}
