"use client";

import { REVIEW_COMMENT_MAX_LENGTH } from "@weeklyreport/shared";
import { useId } from "react";

interface RecordCommentComposerProps {
  readonly draft: string;
  /** Submitted characters, excluding surrounding whitespace. */
  readonly characterCount: number;
  readonly onDraftChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly submitDisabled: boolean;
  readonly isPending: boolean;
  readonly feedbackId?: string;
  /** Accessible name; defaults to the generic label. */
  readonly label?: string | undefined;
  /** Accessible name of the submit button; its visible text stays first. */
  readonly submitLabel?: string | undefined;
  readonly validationError?: string | undefined;
}

export function RecordCommentComposer({
  draft,
  characterCount,
  onDraftChange,
  onSubmit,
  submitDisabled,
  isPending,
  feedbackId,
  label = "Add a review comment",
  submitLabel,
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
        aria-label={label}
        aria-invalid={validationError ? "true" : "false"}
        aria-describedby={[
          limitId,
          validationError ? validationErrorId : undefined,
          feedbackId,
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <div className="flex items-start justify-between gap-2 text-xs">
        <div className="flex flex-col gap-0.5">
          <p className="text-[var(--color-muted-foreground)]">
            Up to {REVIEW_COMMENT_MAX_LENGTH} characters.
          </p>
          {validationError ? (
            <p
              id={validationErrorId}
              role="alert"
              className="text-[var(--color-destructive)]"
            >
              {validationError}
            </p>
          ) : null}
        </div>
        <p id={limitId} className="text-[var(--color-muted-foreground)]">
          {characterCount} / {REVIEW_COMMENT_MAX_LENGTH}
        </p>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="btn-press inline-flex items-center max-md:min-h-[var(--touch-target-min)] rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-3 py-1 text-[12px] font-semibold text-[var(--color-primary-foreground)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          disabled={submitDisabled}
          aria-busy={isPending || undefined}
          aria-label={isPending ? undefined : submitLabel}
        >
          {isPending ? "Adding…" : "Comment"}
        </button>
      </div>
    </form>
  );
}
