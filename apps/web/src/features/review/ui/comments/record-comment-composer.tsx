"use client";

import { REVIEW_COMMENT_MAX_LENGTH } from "@customreport/shared";
import { useId } from "react";

interface RecordCommentComposerProps {
  readonly draft: string;
  readonly onDraftChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly submitDisabled: boolean;
  readonly isPending: boolean;
  readonly feedbackId?: string;
  readonly validationError?: string | undefined;
}

export function RecordCommentComposer({
  draft,
  onDraftChange,
  onSubmit,
  submitDisabled,
  isPending,
  feedbackId,
  validationError,
}: RecordCommentComposerProps) {
  const id = useId();
  const limitId = `${id}-review-comment-limit`;
  const validationErrorId = `${id}-review-comment-validation-error`;
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        className="min-h-[52px] w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-2.5 py-1.5 text-[12.5px] text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)]"
        placeholder="Add a review comment…"
        name="review-comment"
        autoComplete="off"
        value={draft}
        disabled={isPending}
        onChange={(event) => onDraftChange(event.target.value)}
        aria-label="Add a review comment"
        aria-invalid={validationError ? "true" : "false"}
        aria-describedby={[
          limitId,
          validationError ? validationErrorId : feedbackId,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <div className="flex items-start justify-between gap-2 text-xs">
        <p
          id={validationError ? validationErrorId : undefined}
          role={validationError ? "alert" : undefined}
          className={
            validationError
              ? "text-[var(--color-destructive)]"
              : "text-[var(--color-muted-foreground)]"
          }
        >
          {validationError ?? `Up to ${REVIEW_COMMENT_MAX_LENGTH} characters.`}
        </p>
        <p id={limitId} className="text-[var(--color-muted-foreground)]">
          {draft.length} / {REVIEW_COMMENT_MAX_LENGTH}
        </p>
      </div>
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
