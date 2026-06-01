"use client";

import { useCallback, useRef } from "react";

import type {
  Product,
  RiskEntry,
  StageStatus,
} from "../components/lead/mock-data";
import { splitStageNames } from "../components/lead/stage-tags";

// ---------------------------------------------------------------------------
// Status <-> Risk coupling (pure, render-time derivation)
//
// Consolidated from the former `use-status-risk-coupling.ts` and
// `use-status-risk-sync.ts` (code-quality-modernization, Wave 3) so the
// status/risk coordination lives behind a single entry point. The two halves
// are intentionally distinct exports: `computeCoupling`/`validateCoupling`
// are pure functions called at render/memo time, while `useStatusRiskSync`
// is a React hook. Folding the pure functions into the hook would convert
// their render-time call sites into hook calls and change evaluation timing,
// so they stay as standalone exports.
// ---------------------------------------------------------------------------

/**
 * Coupling state for a single at-risk/blocked product.
 * Pure derived data — no side effects.
 */
export interface ProductCoupling {
  productId: string;
  productName: string;
  /** overallStatus narrowed to at-risk/blocked */
  status: "at-risk" | "blocked";
  /** IDs of risk rows for this product that have no stageIds specified */
  riskRowsWithoutStages: string[];
  /**
   * Stages of this product that are at-risk or blocked but have no covering
   * risk row (F10). A risk row covers a stage when its stageIds is empty
   * (= all stages) OR explicitly includes this stageName.
   */
  stagesWithoutRiskCoverage: {
    stageName: string;
    severity: "at-risk" | "blocked";
  }[];
}

export type CouplingState = ProductCoupling[];

/**
 * For each product whose overallStatus is at-risk or blocked:
 * - returns which risk rows lack explicit stage selection (riskRowsWithoutStages)
 * - returns which stages lack a covering risk row (stagesWithoutRiskCoverage)
 *
 * Empty stageIds remains valid for green products (legacy "all stages"
 * shorthand). This invariant is only enforced for red/yellow products.
 */
export function computeCoupling(
  products: readonly Product[],
  risks: readonly RiskEntry[],
): CouplingState {
  const result: CouplingState = [];
  for (const product of products) {
    if (
      product.overallStatus !== "at-risk" &&
      product.overallStatus !== "blocked"
    ) {
      continue;
    }
    const productRisks = risks.filter((r) => r.productId === product.id);
    const riskRowsWithoutStages = productRisks
      .filter((r) => !r.stageIds || r.stageIds.length === 0)
      .map((r) => r.id);

    // F10: find stages that are at-risk/blocked but have no covering risk row.
    const stagesWithoutRiskCoverage: ProductCoupling["stagesWithoutRiskCoverage"] =
      [];
    for (const stage of product.stages) {
      if (stage.status !== "at-risk" && stage.status !== "blocked") continue;
      const isCovered = productRisks.some(
        (r) =>
          !r.stageIds ||
          r.stageIds.length === 0 ||
          r.stageIds.includes(stage.stageName),
      );
      if (!isCovered) {
        stagesWithoutRiskCoverage.push({
          stageName: stage.stageName,
          severity: stage.status as "at-risk" | "blocked",
        });
      }
    }

    result.push({
      productId: product.id,
      productName: product.name,
      status: product.overallStatus as "at-risk" | "blocked",
      riskRowsWithoutStages,
      stagesWithoutRiskCoverage,
    });
  }
  return result;
}

/**
 * Returns IDs of products that have at-risk/blocked status but contain
 * risk rows without explicit stage selection.
 *
 * Empty result means all coupling invariants are satisfied.
 */
export function validateCoupling(coupling: CouplingState): {
  missing: string[];
} {
  const missing = coupling
    .filter((c) => c.riskRowsWithoutStages.length > 0)
    .map((c) => c.productId);
  return { missing };
}

// ---------------------------------------------------------------------------
// Risk -> Stage sync hook
// ---------------------------------------------------------------------------

/**
 * SyncSource discriminates between user-driven changes and auto-sync changes
 * triggered by the inverse handler. The hook short-circuits inverse triggers
 * when source === 'auto-sync' so no infinite loop forms.
 *
 * See: .planning/research/PITFALLS.md (Pitfall 5)
 */
export type SyncSource = "user" | "auto-sync";

type ProductsUpdater = Product[] | ((prev: Product[]) => Product[]);
type RisksUpdater = RiskEntry[] | ((prev: RiskEntry[]) => RiskEntry[]);

export interface StatusUpdateSuggestionParams {
  productId: string;
  productName: string;
  stageName: string;
  suggestedStatus: "at-risk" | "blocked";
}

export interface UseStatusRiskSyncArgs {
  products: Product[];
  risks: RiskEntry[];
  onProductsChange: (next: ProductsUpdater) => void;
  onRisksChange: (next: RisksUpdater) => void;
  /**
   * Invoked when the user fills a risk whose bound stage is currently
   * 'on-track' or 'empty'. The consumer renders a confirmation UI; on accept,
   * it must call `applyStatusSuggestion` to mutate the stage with auto-sync
   * source (skipping the inverse trigger).
   */
  requestStatusUpdateConfirmation: (
    params: StatusUpdateSuggestionParams,
  ) => void;
}

export interface UseStatusRiskSyncResult {
  handleStageStatusChange: (
    productId: string,
    stageName: string,
    newStatus: StageStatus,
    source?: SyncSource,
  ) => void;
  handleRiskFilled: (riskId: string, source?: SyncSource) => void;
  applyStatusSuggestion: (
    productId: string,
    stageName: string,
    status: StageStatus,
  ) => void;
  syncSource: () => SyncSource;
}

/**
 * One-way Risk -> Stage coordination with SyncSource ref to prevent loops.
 *
 * Earlier this hook ALSO auto-appended an empty risk row when the user
 * flipped a stage to at-risk/blocked. The intent was a hint ("you marked
 * this red, now describe it") but the actual UX was a phantom row labelled
 * "— pending" at the top of the Risks list — looked like data corruption
 * the moment a chip changed colour. The unbacked-stage warning banner
 * (`unbackedStages` in lead-form-sync-bridge) carries the same signal
 * without polluting the data model, so the auto-add was removed.
 *
 * Risk -> Stage (with confirmation) remains: when a USER fills a risk
 * whose bound stage is on-track/empty, the hook asks the consumer to
 * confirm bumping the chip. The hook does NOT directly mutate stages;
 * the consumer calls applyStatusSuggestion on accept.
 *
 * The syncSourceRef toggles to 'auto-sync' across the synchronous frame
 * of an auto-triggered mutation so that the inverse handler short-
 * circuits (Pitfall 5).
 */
export function useStatusRiskSync(
  args: UseStatusRiskSyncArgs,
): UseStatusRiskSyncResult {
  const { products, risks, onProductsChange, requestStatusUpdateConfirmation } =
    args;

  const syncSourceRef = useRef<SyncSource>("user");

  const handleStageStatusChange = useCallback(
    (
      productId: string,
      stageName: string,
      newStatus: StageStatus,
      _source: SyncSource = "user",
    ) => {
      // Update the stage status. No automatic side-effects on Risks —
      // the warning banner above the list is now the sole "you marked
      // this red, describe it" affordance.
      onProductsChange((prev) =>
        prev.map((p) => {
          if (p.id !== productId) return p;
          return {
            ...p,
            stages: p.stages.map((s) =>
              s.stageName === stageName ? { ...s, status: newStatus } : s,
            ),
          };
        }),
      );
    },
    [onProductsChange],
  );

  const handleRiskFilled = useCallback(
    (riskId: string, source: SyncSource = "user") => {
      // Loop guard: short-circuit auto-sync triggers (Pitfall 5).
      if (source === "auto-sync") return;

      const risk = risks.find((r) => r.id === riskId);
      if (!risk) return;

      const product = products.find((p) => p.id === risk.productId);
      if (!product) return;

      const stageTags = splitStageNames(risk.stageName);
      const stage = product.stages.find((s) =>
        stageTags.length > 0 ? stageTags.includes(s.stageName) : true,
      );
      if (!stage) return;

      // Only suggest when the bound stage is not already reflecting a risk.
      if (stage.status === "on-track" || stage.status === "empty") {
        requestStatusUpdateConfirmation({
          productId: risk.productId,
          productName: product.name,
          stageName: stage.stageName,
          suggestedStatus: risk.severity,
        });
      }
    },
    [products, risks, requestStatusUpdateConfirmation],
  );

  const applyStatusSuggestion = useCallback(
    (productId: string, stageName: string, status: StageStatus) => {
      syncSourceRef.current = "auto-sync";
      handleStageStatusChange(productId, stageName, status, "auto-sync");
      syncSourceRef.current = "user";
    },
    [handleStageStatusChange],
  );

  return {
    handleStageStatusChange,
    handleRiskFilled,
    applyStatusSuggestion,
    syncSource: () => syncSourceRef.current,
  };
}
