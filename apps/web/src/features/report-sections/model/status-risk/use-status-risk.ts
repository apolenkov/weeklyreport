"use client";

import { useCallback } from "react";

import type { Product, ProductsUpdater, StageStatus } from "../types";

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
