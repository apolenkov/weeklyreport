"use client";

import type { LeadSubmitReadiness } from "../../../../../report-sections";
import type { AutosaveSnapshot } from "../../../../../report-sections/client";
import {
  firstPendingReviewFocus,
  focusCompletionIssue,
} from "../../chrome/overview-completion-focus";
import { useHeaderActionsVisibility } from "../../chrome/use-header-actions-visibility";

interface CompletionPresentationInput {
  readonly autosave: AutosaveSnapshot;
  readonly handleSubmit: () => void;
  readonly readiness: LeadSubmitReadiness;
  readonly isSlidesMode: boolean;
  readonly isReadOnly: boolean;
  readonly canHandOffActions?: boolean;
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
  readonly headerActionsVisible: boolean;
  readonly readiness: LeadSubmitReadiness;
  readonly sentinelRef: (node: HTMLDivElement | null) => void;
  readonly showCompletionSurface: boolean;
  readonly showStickyCompletion: boolean;
}

export function useCompletionPresentation(
  input: CompletionPresentationInput,
): CompletionPresentation {
  const { headerActionsVisible: observedHeaderVisible, sentinelRef } =
    useHeaderActionsVisibility();
  const headerActionsVisible =
    input.canHandOffActions === false || observedHeaderVisible;
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
  const showCompletionSurface = !input.isSlidesMode && !input.isReadOnly;

  return {
    completionActions,
    headerActionsVisible,
    readiness: input.readiness,
    sentinelRef,
    showCompletionSurface,
    showStickyCompletion: showCompletionSurface && !headerActionsVisible,
  };
}
