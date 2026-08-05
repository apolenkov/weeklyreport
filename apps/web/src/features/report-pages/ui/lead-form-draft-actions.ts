import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";

import type {
  DecisionEntry,
  KanbanItem,
  Product,
  RiskEntry,
} from "../../report-sections";
import {
  markCompletePatch,
  moveToCurrentWeekPatch,
  moveToNextWeekPatch,
  pauseItemPatch,
} from "../../report-sections";
import type { DraftPatch } from "./lead-form-draft-patch";
import type { RiskPrefillRequest } from "./lead-form-sync-bridge";
import type { QuickAddKind } from "./quick-add-button";
import type { LeadFormAddSignals } from "./use-lead-form-add-signals";
import type { QuickAddItem } from "./use-lead-form-quick-add";

// Declared draft-module seam — not the hook's raw return type.
export interface LeadFormDraftHandle {
  readonly apply: (patch: DraftPatch) => void;
  readonly routeToBlocker: (
    prefill: Omit<RiskPrefillRequest, "signal">,
  ) => void;
  readonly quickAdd: (week: "current" | "next") => void;
  readonly pendingQuickAdd: QuickAddItem | null;
  readonly quickAddSave: (item: KanbanItem) => void;
  readonly clearQuickAdd: () => void;
  readonly pendingRiskPrefill: RiskPrefillRequest | null;
}

function buildCollectionActions(draft: LeadFormDraftHandle) {
  return {
    onProductsChange: (next: readonly Product[]) =>
      draft.apply({ kind: "products", products: next }),
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

function buildItemPatchActions(draft: LeadFormDraftHandle) {
  const patchItem = (
    itemId: string,
    patch: Partial<ReportSectionReadModel["items"][number]>,
  ) => draft.apply({ kind: "item-patch", itemId, patch });
  return {
    onMarkComplete: (itemId: string) => patchItem(itemId, markCompletePatch()),
    onMoveToNextWeek: (itemId: string) =>
      patchItem(itemId, moveToNextWeekPatch()),
    onMoveToCurrentWeek: (itemId: string) =>
      patchItem(itemId, moveToCurrentWeekPatch()),
    onPauseItem: (itemId: string, reason: string) =>
      patchItem(itemId, pauseItemPatch(reason)),
  };
}

function buildActivityActions(draft: LeadFormDraftHandle) {
  return {
    onActivityStatusChange: (activityId: string, status: TrafficLightStatus) =>
      draft.apply({ kind: "activity-status", activityId, status }),
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
      // A blocker is a product-scoped risk; without a product there is no
      // valid parent, so the quick-add stays inert (menu disables it).
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
) {
  return {
    ...buildCollectionActions(draft),
    ...buildItemPatchActions(draft),
    ...buildActivityActions(draft),
    onQuickAdd: buildQuickAddHandler(draft, addSignals, viewModel.products),
    quickAddItem: draft.pendingQuickAdd,
    onQuickAddSave: draft.quickAddSave,
    onQuickAddCancel: draft.clearQuickAdd,
    riskPrefill: draft.pendingRiskPrefill,
    ...addSignals,
  };
}
