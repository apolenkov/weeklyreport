import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";

import {
  markCompletePatch,
  moveToCurrentWeekPatch,
  moveToNextWeekPatch,
  pauseItemPatch,
} from "../../../lib/lead-item-actions";
import type {
  DecisionEntry,
  KanbanItem,
  Product,
  RiskEntry,
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
    onProductsChange: (next: Product[]) =>
      draft.apply({ kind: "products", products: next }),
    onRisksChange: (next: RiskEntry[]) =>
      draft.apply({ kind: "risks", risks: next }),
    onDecisionsChange: (next: DecisionEntry[]) =>
      draft.apply({ kind: "decisions", decisions: next }),
    onCurrentWeekItemsChange: (items: KanbanItem[]) =>
      draft.apply({ kind: "week-items", week: "current", items }),
    onNextWeekItemsChange: (items: KanbanItem[]) =>
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
        stageIds: [],
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
    blocker: () =>
      draft.routeToBlocker({
        productId: products[0]?.id ?? "",
        stageIds: [],
        severity: "blocked",
      }),
    risk: addSignals.addRisk,
    decision: addSignals.addDecision,
  };
  return (kind) => byKind[kind]();
}

/**
 * Build Draft Actions.
 * @param draft - The draft argument.
 * @param addSignals - The addSignals argument.
 * @param viewModel - The viewModel argument.
 */
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
