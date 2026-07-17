"use client";

import { useCallback } from "react";

import { riskCoversStage } from "../features/report-sections/model/stage-tags";
import type {
  Product,
  RiskEntry,
  StageStatus,
} from "../features/report-sections/model/types";

// ---------------------------------------------------------------------------
// Status <-> Risk coupling (pure, render-time derivation)
//
// The two halves are intentionally distinct exports:
// `computeCoupling`/`validateCoupling` are pure functions called at
// render/memo time, while `useStatusRiskSync` is a React hook. Folding the
// pure functions into the hook would convert their render-time call sites
// into hook calls and change evaluation timing, so they stay as standalone
// exports.
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
      // stage-label-canonicalization: match via the canonical `riskCoversStage`
      // (empty stageIds = covers all; otherwise canonical name match) instead of
      // a raw `includes`, so a legacy "Dev"-stored risk still covers the
      // canonical "Development" stage.
      const isCovered = productRisks.some((r) =>
        riskCoversStage(r, stage.stageName),
      );
      if (!isCovered) {
        stagesWithoutRiskCoverage.push({
          stageName: stage.stageName,
          severity: stage.status,
        });
      }
    }

    result.push({
      productId: product.id,
      productName: product.name,
      status: product.overallStatus,
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
// Stage status apply hook
// ---------------------------------------------------------------------------

type ProductsUpdater = Product[] | ((prev: Product[]) => Product[]);

export interface UseStatusRiskSyncArgs {
  onProductsChange: (next: ProductsUpdater) => void;
}

export interface UseStatusRiskSyncResult {
  handleStageStatusChange: (
    productId: string,
    stageName: string,
    newStatus: StageStatus,
  ) => void;
}

/**
 * Stage status applier.
 *
 * The hook only applies stage status changes; the bridge
 * (`lead-form-sync-bridge`) owns interception of conflicting transitions
 * (raise without a risk, lower with covering risks). A saved risk forces its
 * covered chips to at least its severity (automatic severity floor), so there
 * is no opt-in "bump the chip?" suggestion to make.
 */
export function useStatusRiskSync(
  args: UseStatusRiskSyncArgs,
): UseStatusRiskSyncResult {
  const { onProductsChange } = args;

  const handleStageStatusChange = useCallback(
    (productId: string, stageName: string, newStatus: StageStatus) => {
      // Update the stage status. No automatic side-effects on Risks —
      // risk creation/removal is routed explicitly by the bridge.
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

  return {
    handleStageStatusChange,
  };
}
