"use client";

import { useCallback } from "react";

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
interface ProductCoupling {
  productId: string;
  productName: string;
  /** overallStatus narrowed to at-risk/blocked */
  status: "at-risk" | "blocked";
  /** IDs of risk rows for this product that have no stageIds specified */
  riskRowsWithoutStages: string[];
}

export type CouplingState = ProductCoupling[];

/**
 * For each product whose overallStatus is at-risk or blocked:
 * - returns which risk rows lack explicit stage selection (riskRowsWithoutStages)
 *
 * Empty stageIds remains valid for green products (legacy "all stages"
 * shorthand). This invariant is only enforced for red/yellow products.
 */
export function computeCoupling(
  products: readonly Product[],
  risks: readonly RiskEntry[],
): CouplingState {
  return products.flatMap((product) => {
    if (
      product.overallStatus !== "at-risk" &&
      product.overallStatus !== "blocked"
    ) {
      return [];
    }

    return [
      {
        productId: product.id,
        productName: product.name,
        status: product.overallStatus,
        riskRowsWithoutStages: risks
          .filter(
            (risk) =>
              risk.productId === product.id &&
              (!risk.stageIds || risk.stageIds.length === 0),
          )
          .map((risk) => risk.id),
      },
    ];
  });
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
