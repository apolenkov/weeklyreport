"use client";

import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

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
} from "../model/mock-data";
import {
  mergeActivityStatusDraft,
  mergeDecisionDraft,
  mergeItemsDraft,
  mergeProductDraft,
  mergeRiskDraft,
  patchDraftItem,
} from "./lead-form-draft-merge-helpers";
import type { RiskPrefillRequest } from "./lead-form-sync-bridge";
import type { QuickAddKind } from "./quick-add-button";

interface LoadedDraftMergeContext {
  readonly products: readonly Product[];
  readonly currentWeekItems: readonly KanbanItem[];
  readonly nextWeekItems: readonly KanbanItem[];
}

interface UseLeadFormDraftMergesArgs {
  readonly setDraftSection: Dispatch<
    SetStateAction<ReportSectionReadModel | null>
  >;
  readonly getLoadedContext: () => LoadedDraftMergeContext;
}

export function useLeadFormDraftMerges({
  setDraftSection,
  getLoadedContext,
}: UseLeadFormDraftMergesArgs) {
  const [currentWeekAddSignal, setCurrentWeekAddSignal] = useState(0);
  const [nextWeekAddSignal, setNextWeekAddSignal] = useState(0);
  const [risksAddSignal, setRisksAddSignal] = useState(0);
  const [decisionsAddSignal, setDecisionsAddSignal] = useState(0);
  const [riskPrefill, setRiskPrefill] = useState<RiskPrefillRequest | null>(
    null,
  );
  const [quickAddItem, setQuickAddItem] = useState<{
    week: "current" | "next";
    seq: number;
  } | null>(null);

  const handleProductsChange = (next: Product[]) => {
    setDraftSection((prev) => (prev ? mergeProductDraft(prev, next) : prev));
  };

  const handleActivityStatusChange = (
    activityId: string,
    status: TrafficLightStatus,
  ) => {
    setDraftSection((prev) =>
      prev ? mergeActivityStatusDraft(prev, activityId, status) : prev,
    );
  };

  const handleRisksChange = (next: RiskEntry[]) => {
    setDraftSection((prev) => (prev ? mergeRiskDraft(prev, next) : prev));
  };

  const handleDecisionsChange = (next: DecisionEntry[]) => {
    setDraftSection((prev) => (prev ? mergeDecisionDraft(prev, next) : prev));
  };

  const handleCurrentWeekItemsChange = (next: KanbanItem[]) => {
    setDraftSection((prev) =>
      prev ? mergeItemsDraft(prev, "current", next) : prev,
    );
  };

  const handleNextWeekItemsChange = (next: KanbanItem[]) => {
    setDraftSection((prev) =>
      prev ? mergeItemsDraft(prev, "next", next) : prev,
    );
  };

  const updateDraftItemInPlace = (
    itemId: string,
    patch: Partial<ReportSectionReadModel["items"][number]>,
  ) => {
    setDraftSection((prev) =>
      prev ? patchDraftItem(prev, itemId, patch) : prev,
    );
  };

  const handleMarkComplete = (itemId: string) => {
    updateDraftItemInPlace(itemId, markCompletePatch());
  };

  const handleMoveToNextWeek = (itemId: string) => {
    updateDraftItemInPlace(itemId, moveToNextWeekPatch());
  };

  const handleMoveToCurrentWeek = (itemId: string) => {
    updateDraftItemInPlace(itemId, moveToCurrentWeekPatch());
  };

  const handlePauseItem = (itemId: string, reason: string) => {
    updateDraftItemInPlace(itemId, pauseItemPatch(reason));
  };

  const routeToBlocker = (prefill: Omit<RiskPrefillRequest, "signal">) => {
    setRiskPrefill((prev) => ({ signal: (prev?.signal ?? 0) + 1, ...prefill }));
  };

  const handleActivityRaiseRequiresRisk = (
    activityId: string,
    severity: "at-risk" | "blocked",
  ) => {
    routeToBlocker({ productId: "", stageIds: [], severity, activityId });
  };

  const handleQuickAdd = (kind: QuickAddKind) => {
    if (kind === "blocker") {
      routeToBlocker({
        productId: getLoadedContext().products[0]?.id ?? "",
        stageIds: [],
        severity: "blocked",
      });
      return;
    }
    if (kind === "risk") {
      setRisksAddSignal((value) => value + 1);
      return;
    }
    if (kind === "decision") {
      setDecisionsAddSignal((value) => value + 1);
      return;
    }
    setQuickAddItem((prev) => ({
      week: kind === "next-item" ? "next" : "current",
      seq: (prev?.seq ?? 0) + 1,
    }));
  };

  const handleQuickAddSave = (next: KanbanItem) => {
    if (!quickAddItem) return;
    const context = getLoadedContext();
    if (quickAddItem.week === "next") {
      handleNextWeekItemsChange([...context.nextWeekItems, next]);
    } else {
      handleCurrentWeekItemsChange([...context.currentWeekItems, next]);
    }
    setQuickAddItem(null);
  };

  return {
    currentWeekAddSignal,
    decisionsAddSignal,
    handleActivityRaiseRequiresRisk,
    handleActivityStatusChange,
    handleAddCurrentWeekItem: () =>
      setCurrentWeekAddSignal((value) => value + 1),
    handleAddDecision: () => setDecisionsAddSignal((value) => value + 1),
    handleAddNextWeekItem: () => setNextWeekAddSignal((value) => value + 1),
    handleAddRisk: () => setRisksAddSignal((value) => value + 1),
    handleCurrentWeekItemsChange,
    handleDecisionsChange,
    handleMarkComplete,
    handleMoveToCurrentWeek,
    handleMoveToNextWeek,
    handleNextWeekItemsChange,
    handlePauseItem,
    handleProductsChange,
    handleQuickAdd,
    handleQuickAddCancel: () => setQuickAddItem(null),
    handleQuickAddSave,
    handleRequestBlocker: routeToBlocker,
    handleRisksChange,
    nextWeekAddSignal,
    quickAddItem,
    riskPrefill,
    risksAddSignal,
  };
}
