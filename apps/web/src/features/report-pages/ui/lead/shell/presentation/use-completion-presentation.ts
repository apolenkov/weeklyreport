"use client";

import type { LeadSubmitReadiness } from "../../../../../report-sections";
import type { AutosaveSnapshot } from "../../../../../report-sections/client";
import {
  firstPendingReviewFocus,
  focusCompletionIssue,
} from "../../chrome/overview-completion-focus";

interface CompletionPresentationInput {
  readonly autosave: AutosaveSnapshot;
  readonly handleSubmit: () => void;
  readonly readiness: LeadSubmitReadiness;
  readonly isSlidesMode: boolean;
  readonly isReadOnly: boolean;
}

export interface CompletionPresentation {
  readonly completionActions: {
    readonly autosave: AutosaveSnapshot;
    readonly onSubmit: () => void;
    readonly submitDisabled: boolean;
    readonly submitDisabledReason: string | undefined;
    readonly pendingReviewCount: number;
    readonly onReviewPending: () => void;
  };
  readonly readiness: LeadSubmitReadiness;
  readonly showCompletionSurface: boolean;
}

// Completion actions live in the header only (lead-completion-guidance): no
// rail takes over when the header scrolls away.
export function useCompletionPresentation(
  input: CompletionPresentationInput,
): CompletionPresentation {
  const pendingFocus = firstPendingReviewFocus(input.readiness);
  const completionActions = {
    autosave: input.autosave,
    onSubmit: input.handleSubmit,
    submitDisabled: !input.readiness.canOpenConfirmation,
    submitDisabledReason: input.readiness.submitPending
      ? "Submitting report…"
      : input.readiness.blockingIssues[0]?.label,
    pendingReviewCount: input.isSlidesMode
      ? 0
      : input.readiness.pendingReviewCount,
    onReviewPending: () => focusCompletionIssue(pendingFocus),
  };

  return {
    completionActions,
    readiness: input.readiness,
    showCompletionSurface: !input.isSlidesMode && !input.isReadOnly,
  };
}
