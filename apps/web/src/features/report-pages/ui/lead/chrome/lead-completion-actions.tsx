"use client";

import { useId } from "react";

import { SaveNowButton } from "../../../../../shared/ui/report-shell/save-now-button";
import { pendingReviewLabel } from "../../../../report-sections";
import type { AutosaveSnapshot } from "../../../../report-sections/client";
import { focusCompletionIssue } from "./overview-completion-focus";

export interface LeadCompletionActionContract {
  readonly autosave: AutosaveSnapshot;
  readonly onSubmit: () => void;
  readonly submitDisabled: boolean;
  readonly submitDisabledReason?: string | undefined;
  /** Suggested continuations the lead has not confirmed yet. */
  readonly pendingReviewCount?: number | undefined;
  readonly onReviewPending?: (() => void) | undefined;
}

interface LeadCompletionActionsProps extends LeadCompletionActionContract {
  readonly label: string;
  readonly compact?: boolean | undefined;
}

export function LeadCompletionActions({
  autosave,
  onSubmit,
  submitDisabled,
  submitDisabledReason,
  pendingReviewCount = 0,
  onReviewPending,
  label,
  compact = false,
}: LeadCompletionActionsProps) {
  const reasonId = useId();
  const reason = submitDisabled ? submitDisabledReason : undefined;
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex flex-wrap items-center justify-end gap-2 [&_button]:min-h-10 ${
        compact
          ? "max-sm:w-full max-sm:justify-stretch max-sm:[&_button]:flex-1 max-md:[&_button]:min-h-[var(--touch-target-min)] max-md:[&_button]:min-w-[var(--touch-target-min)]"
          : ""
      }`}
    >
      {autosave.state === "error" ? (
        <SaveNowButton autosave={autosave} />
      ) : null}
      {pendingReviewCount > 0 ? (
        <button
          type="button"
          data-testid="pending-review-count"
          onClick={onReviewPending ?? (() => focusCompletionIssue())}
          className="rounded-[var(--radius-pill)] px-3 text-sm font-semibold text-[var(--color-primary)] underline underline-offset-4 transition-colors hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pendingReviewLabel(pendingReviewCount)}
        </button>
      ) : null}
      <button
        type="button"
        className="btn-press inline-flex h-[var(--toolbar-control-h)] min-h-10 items-center justify-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-[var(--color-starbucks-accent)] px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-primary-foreground)] transition-colors hover:bg-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onSubmit}
        disabled={submitDisabled}
        data-testid="lead-completion-submit"
        aria-describedby={reason ? reasonId : undefined}
      >
        Submit
      </button>
      {reason ? (
        <p
          id={reasonId}
          data-testid="lead-completion-disabled-reason"
          className="w-full min-w-0 break-words text-sm text-[var(--color-muted-foreground)]"
        >
          {reason}
        </p>
      ) : null}
    </div>
  );
}
