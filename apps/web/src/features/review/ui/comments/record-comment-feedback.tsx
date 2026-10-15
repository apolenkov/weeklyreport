"use client";

import type { RecordCommentView } from "@weeklyreport/shared";

import { ConfirmDeleteDialog } from "../../../../shared/ui/dialogs/confirm-delete-dialog";

export type CommentFeedback = Readonly<{
  message: string;
  tone: "error" | "success";
}>;

export function CommentFeedbackMessage({
  feedback,
  id,
}: {
  readonly feedback: CommentFeedback | null;
  readonly id: string;
}) {
  if (!feedback) return null;
  const isError = feedback.tone === "error";
  return (
    <p
      id={id}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className={`break-words text-xs [overflow-wrap:anywhere] ${
        isError
          ? "text-[var(--color-destructive)]"
          : "text-[var(--color-muted-foreground)]"
      }`}
    >
      {feedback.message}
    </p>
  );
}

export function CommentDeleteDialog({
  candidate,
  isPending,
  onConfirm,
  onCancel,
}: {
  readonly candidate: RecordCommentView | null;
  readonly isPending: boolean;
  readonly onConfirm: (commentId: string) => void;
  readonly onCancel: () => void;
}) {
  return (
    <ConfirmDeleteDialog
      open={candidate !== null}
      title="Delete review comment?"
      preview={candidate?.text ?? ""}
      subtitle={candidate?.reviewerName ?? "Reviewer"}
      isPending={isPending}
      onConfirm={() => {
        if (candidate) onConfirm(candidate.id);
      }}
      onCancel={onCancel}
    />
  );
}
