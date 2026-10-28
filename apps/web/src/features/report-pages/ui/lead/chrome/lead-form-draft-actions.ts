import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@weeklyreport/shared";
import { toast } from "sonner";

import type {
  DecisionEntry,
  KanbanItem,
  Product,
  RiskEntry,
} from "../../../../report-sections";
import type {
  DraftPatch,
  RiskPrefillRequest,
} from "../../../../report-sections";
import {
  buildNextWeekPlanAcknowledgementPatch,
  promoteContinuationPatch,
} from "../../../../report-sections";
import type { QuickAddItem } from "../../../../report-sections/client";
import type { QuickAddKind } from "./quick-add-button";
import type { LeadFormAddSignals } from "./use-lead-form-add-signals";

// Move on an occurrence whose saved next step already plans the next week only
// acknowledges that plan; it never replaces the result with its continuation.
export const NEXT_WEEK_PLAN_CONFIRMED_MESSAGE = "Already planned for next week";

// Declared draft-module seam — not the hook's raw return type.
export interface LeadFormDraftHandle {
  readonly apply: (patch: DraftPatch) => void;
  readonly routeToBlocker: (
    prefill: Omit<RiskPrefillRequest, "signal">,
  ) => void;
  readonly quickAdd: (week: "current" | "next") => void;
  readonly pendingQuickAdd: QuickAddItem | null;
  readonly quickAddSave: (
    item: KanbanItem,
    options?: { readonly addAnother?: boolean },
  ) => void;
  readonly clearQuickAdd: () => void;
  readonly pendingRiskPrefill: RiskPrefillRequest | null;
}

function buildCollectionActions(draft: LeadFormDraftHandle) {
  return {
    onProductsChange: (
      next: Extract<DraftPatch, { readonly kind: "products" }>["products"],
    ) => draft.apply({ kind: "products", products: next }),
    onRisksChange: (next: readonly RiskEntry[]) =>
      draft.apply({ kind: "risks", risks: next }),
    onDecisionsChange: (next: readonly DecisionEntry[]) =>
      draft.apply({ kind: "decisions", decisions: next }),
    onCurrentWeekItemsChange: (items: readonly KanbanItem[]) =>
      draft.apply({ kind: "week-items", week: "current", items }),
    onNextWeekItemsChange: (items: readonly KanbanItem[]) =>
      draft.apply({ kind: "week-items", week: "next", items }),
  };
}

function buildItemPatchActions(
  draft: LeadFormDraftHandle,
  section: ReportSectionReadModel,
) {
  const patchItem = (
    itemId: string,
    patch: Partial<ReportSectionReadModel["items"][number]>,
  ) => draft.apply({ kind: "item-patch", itemId, patch });
  return {
    onMarkComplete: (itemId: string) =>
      draft.apply({ kind: "complete-item", itemId }),
    onMoveToNextWeek: (itemId: string) => {
      // The toast follows the exact patch the command applies, so a refused move
      // never claims that a plan was acknowledged.
      const acknowledgement = buildNextWeekPlanAcknowledgementPatch(
        section,
        itemId,
      );
      draft.apply({ kind: "move-item", itemId, target: "next" });
      if (acknowledgement !== null)
        toast.success(NEXT_WEEK_PLAN_CONFIRMED_MESSAGE);
    },
    onMoveToCurrentWeek: (itemId: string) =>
      draft.apply({ kind: "move-item", itemId, target: "current" }),
    onPauseItem: (itemId: string, reason: string) =>
      draft.apply({ kind: "pause-item", itemId, reason }),
    onPromoteContinuation: (itemId: string, nextText: string) =>
      patchItem(itemId, promoteContinuationPatch(nextText)),
  };
}

function buildActivityActions(draft: LeadFormDraftHandle) {
  const ACTIVITY_STATUS_PATCH = "activity-status" as const;
  return {
    onActivityStatusChange: (activityId: string, status: TrafficLightStatus) =>
      draft.apply({ kind: ACTIVITY_STATUS_PATCH, activityId, status }),
    onActivityTitleChange: (activityId: string, titleOverride: string | null) =>
      draft.apply({
        kind: ACTIVITY_STATUS_PATCH,
        activityId,
        titleOverride,
      }),
    onActivityDescriptionChange: (activityId: string, note: string | null) =>
      draft.apply({ kind: ACTIVITY_STATUS_PATCH, activityId, note }),
    onActivityRaiseRequiresRisk: (
      activityId: string,
      severity: "at-risk" | "blocked",
    ) =>
      draft.routeToBlocker({
        productId: "",
        stageNames: [],
        severity,
        activityId,
      }),
  };
}

function buildQuickAddHandler(
  draft: LeadFormDraftHandle,
  addSignals: LeadFormAddSignals,
  products: readonly Product[],
): (kind: QuickAddKind) => void {
  const byKind: Record<QuickAddKind, () => void> = {
    "current-item": () => draft.quickAdd("current"),
    "next-item": () => draft.quickAdd("next"),
    blocker: () => {
      const productId = products[0]?.id;
      // This shortcut prefills a product; activity blockers use the activity
      // risk editor. The menu disables this shortcut without a product.
      if (!productId) return;
      draft.routeToBlocker({
        productId,
        stageNames: [],
        severity: "blocked",
      });
    },
    risk: addSignals.addRisk,
    decision: addSignals.addDecision,
  };
  return (kind) => byKind[kind]();
}

export function buildDraftActions(
  draft: LeadFormDraftHandle,
  addSignals: LeadFormAddSignals,
  viewModel: { readonly products: readonly Product[] },
  section: ReportSectionReadModel,
) {
  return {
    ...buildCollectionActions(draft),
    ...buildItemPatchActions(draft, section),
    ...buildActivityActions(draft),
    onQuickAdd: buildQuickAddHandler(draft, addSignals, viewModel.products),
    quickAddItem: draft.pendingQuickAdd,
    onQuickAddSave: draft.quickAddSave,
    onQuickAddSaveAndAddAnother: (item: KanbanItem) =>
      draft.quickAddSave(item, { addAnother: true }),
    onQuickAddCancel: draft.clearQuickAdd,
    riskPrefill: draft.pendingRiskPrefill,
    ...addSignals,
  };
}
