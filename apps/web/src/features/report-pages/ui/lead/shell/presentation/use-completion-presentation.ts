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
  readonly onQuickAdd: (kind: QuickAddKind) => void;
  readonly handleSubmit: () => void;
  readonly readiness: LeadSubmitReadiness;
  readonly isSlidesMode: boolean;
  readonly isReadOnly: boolean;
}

export interface CompletionPresentation {
  readonly completionActions: {
    readonly autosave: AutosaveSnapshot;
    readonly onAdd: (kind: QuickAddKind) => void;
    readonly addDisabled: boolean;
    readonly disabledQuickAddKinds: ReadonlySet<QuickAddKind> | undefined;
    readonly onSubmit: () => void;
    readonly submitDisabled: boolean;
    readonly submitDisabledReason: string | undefined;
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
    onAdd: input.onQuickAdd,
    addDisabled: input.products.length === 0,
    disabledQuickAddKinds:
      input.products.length === 0
        ? new Set<QuickAddKind>(["blocker"])
        : undefined,
    onSubmit: input.handleSubmit,
    submitDisabled: !input.readiness.canOpenConfirmation,
    submitDisabledReason: input.readiness.blockingIssues[0]?.label,
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
