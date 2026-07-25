import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateReview } from "../../../lib/cache-keys";
import { useTRPC } from "../../../lib/trpc-context";
import type { RecordCommentAnchor } from "./record-comments";

function reviewErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function useRecordCommentMutations(
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

  function submitComment(text: string) {
    commentMut.mutate({ ...anchor, text });
  }

  function deleteComment(commentId: string) {
    deleteMut.mutate({ commentId });
  }

  return {
    submitComment,
    isCommentPending: commentMut.isPending,
    deleteComment,
    isDeletePending: deleteMut.isPending,
  };
}
