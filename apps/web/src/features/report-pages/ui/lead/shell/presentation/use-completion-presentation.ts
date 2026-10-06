"use client";

import type {
  LeadSubmitReadiness,
  Product,
} from "../../../../../report-sections";
import type { AutosaveSnapshot } from "../../../../../report-sections/client";
import type { QuickAddKind } from "../../chrome/quick-add-button";
import { useHeaderActionsVisibility } from "../../chrome/use-header-actions-visibility";

interface CompletionPresentationInput {
  readonly autosave: AutosaveSnapshot;
  readonly products: readonly Product[];
  readonly activityCount: number;
  readonly onQuickAdd: (kind: QuickAddKind) => void;
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
  const { headerActionsVisible, sentinelRef } = useHeaderActionsVisibility();
  const completionActions = {
    autosave: input.autosave,
    onSubmit: input.handleSubmit,
    submitDisabled: !input.readiness.canOpenConfirmation,
    submitDisabledReason: input.readiness.blockingIssues[0]?.label,
    pendingReviewCount: input.readiness.pendingReviewCount,
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
