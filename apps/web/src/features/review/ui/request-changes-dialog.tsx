"use client";

import {
  REVIEW_COMMENT_MAX_LENGTH,
  type ReviewVerdictResult,
} from "@customreport/shared";
import { useMutation } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { DialogSurface } from "../../../shared/ui/dialogs/dialog-surface";

interface RequestChangesDialogProps {
  readonly reportSectionId: string;
  readonly version: number;
  /** Names the section owner in the dialog title when known. */
  readonly subjectName?: string | undefined;
  readonly onClose: () => void;
  readonly onRequested: (result: ReviewVerdictResult) => void;
}

const EMPTY_REASON_ERROR = "Enter a reason for the lead.";

// Collects the mandatory reason before a changes_requested verdict is sent.
// Server rejections stay inline with the typed text so nothing is lost.
export function RequestChangesDialog({
  reportSectionId,
  version,
  subjectName,
  onClose,
  onRequested,
}: RequestChangesDialogProps) {
  const trpc = useTRPC();
  const id = useId();
  const errorId = `${id}-error`;
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation(
    trpc.review.verdict.mutationOptions({
      onSuccess: (result) => {
        onRequested(result);
        onClose();
      },
      onError: (err) => {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Failed to request changes.",
        );
      },
    }),
  );
  const isPending = mutation.isPending;
  const closeIfIdle = () => {
    if (!isPending) onClose();
  };
  useDialogFocus({
    open: true,
    onClose: closeIfIdle,
    containerRef: surfaceRef,
  });

  const submit = () => {
    const comment = reason.trim();
    if (comment === "") {
      setError(EMPTY_REASON_ERROR);
      return;
    }
    setError(null);
    mutation.mutate({
      reportSectionId,
      verdict: "changes_requested",
      version,
      comment,
    });
  };

  return (
    <DialogSurface
      surfaceRef={surfaceRef}
      onDismiss={closeIfIdle}
      isPending={isPending}
      surfaceClassName="animate-scale-in mx-4 flex w-full max-w-md flex-col rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-xl"
      ariaLabelledBy={`${id}-title`}
      testId="request-changes-dialog"
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h3
          id={`${id}-title`}
          className="text-lg font-semibold text-[var(--color-foreground)]"
        >
          {subjectName
            ? `Request changes from ${subjectName}`
            : "Request changes"}
        </h3>
        <label
          htmlFor={`${id}-reason`}
          className="text-sm font-medium text-[var(--color-foreground)]"
        >
          Reason for the lead
        </label>
        <textarea
          id={`${id}-reason`}
          name="request-changes-reason"
          autoComplete="off"
          rows={4}
          maxLength={REVIEW_COMMENT_MAX_LENGTH}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setError(null);
          }}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : undefined}
          placeholder="What should the lead change?…"
          className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        />
        <div className="flex items-start justify-between gap-2 text-[11px]">
          <p
            id={error ? errorId : undefined}
            role={error ? "alert" : undefined}
            className={
              error
                ? "text-[var(--color-destructive)]"
                : "text-[var(--color-muted-foreground)]"
            }
          >
            {error ?? "The lead sees this note on the returned section."}
          </p>
          <p className="text-[var(--color-muted-foreground)]">
            {reason.length} / {REVIEW_COMMENT_MAX_LENGTH}
          </p>
        </div>
        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={closeIfIdle}
            className="btn-press rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-surface-hover)] max-md:min-h-[var(--touch-target-min)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-interaction-effect="mutation-required"
            className="btn-press rounded-[var(--radius-pill)] bg-[var(--color-destructive)] px-4 py-2 text-sm font-semibold text-[var(--color-destructive-foreground)] transition-opacity max-md:min-h-[var(--touch-target-min)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Requesting…" : "Request changes"}
          </button>
        </div>
      </form>
    </DialogSurface>
  );
}
