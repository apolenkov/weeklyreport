"use client";

import { useCallback } from "react";

import type {
  Product,
  RiskEntry,
  StageStatus,
} from "../features/report-sections/model/types";

// Pure functions stay standalone: folding them into the hook would force
// render-time call sites onto hook rules and change evaluation timing.
interface ProductCoupling {
  productId: string;
  productName: string;
  status: "at-risk" | "blocked";
  riskRowsWithoutStages: string[];
}

export type CouplingState = ProductCoupling[];

// Empty stageNames is valid for green products (legacy "all stages"); enforced only for red/yellow.
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
              (!risk.stageNames || risk.stageNames.length === 0),
          )
          .map((risk) => risk.id),
      },
    ];
  });
}

export function validateCoupling(coupling: CouplingState): {
  missing: string[];
} {
  const missing = coupling
    .filter((c) => c.riskRowsWithoutStages.length > 0)
    .map((c) => c.productId);
  return { missing };
}

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

// Rebuilds only the addressed product and stage; every other row keeps its
// identity so downstream memoization is untouched.
function applyStageStatus(
  products: readonly Product[],
  productId: string,
  stageName: string,
  status: StageStatus,
): Product[] {
  return products.map((product) =>
    product.id === productId
      ? {
          ...product,
          stages: product.stages.map((stage) =>
            stage.stageName === stageName ? { ...stage, status } : stage,
          ),
        }
      : product,
  );
}

// Applies stage status only; the lead-form-sync-bridge owns conflicting transitions.
// A saved risk floors covered chips to at least its severity — no opt-in bump prompt.
export function useStatusRiskSync(
  args: UseStatusRiskSyncArgs,
): UseStatusRiskSyncResult {
  const { onProductsChange } = args;

  const handleStageStatusChange = useCallback(
    (productId: string, stageName: string, newStatus: StageStatus) => {
      onProductsChange((prev) =>
        applyStageStatus(prev, productId, stageName, newStatus),
      );
    },
    [onProductsChange],
  );

  return {
    handleStageStatusChange,
  };
}
