'use client';

import { useCallback, useRef } from 'react';

import type { Product, RiskEntry, StageStatus } from '../components/lead/mock-data';

/**
 * SyncSource discriminates between user-driven changes and auto-sync changes
 * triggered by the inverse handler. The hook short-circuits inverse triggers
 * when source === 'auto-sync' so no infinite loop forms.
 *
 * See: .planning/research/PITFALLS.md (Pitfall 5)
 */
export type SyncSource = 'user' | 'auto-sync';

type ProductsUpdater = Product[] | ((prev: Product[]) => Product[]);
type RisksUpdater = RiskEntry[] | ((prev: RiskEntry[]) => RiskEntry[]);

export type StatusUpdateSuggestionParams = {
  productId: string;
  productName: string;
  stageName: string;
  suggestedStatus: 'at-risk' | 'blocked';
};

export type UseStatusRiskSyncArgs = {
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
  requestStatusUpdateConfirmation: (params: StatusUpdateSuggestionParams) => void;
};

export type UseStatusRiskSyncResult = {
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
};

/**
 * Bidirectional Status<->Risk coordination with SyncSource ref to prevent loops.
 *
 * - Stage -> Risk (additive): when a USER sets a stage to at-risk/blocked AND no
 *   risk exists for that product+stage, append an empty risk row scoped to it.
 * - Risk -> Stage (with confirmation): when a USER fills a risk whose bound stage
 *   is on-track/empty, request a confirmation from the consumer. The hook does
 *   NOT directly mutate stages; the consumer calls applyStatusSuggestion on accept.
 *
 * The syncSourceRef toggles to 'auto-sync' across the synchronous frame of an
 * auto-triggered mutation so that the inverse handler short-circuits.
 */
export function useStatusRiskSync(
  args: UseStatusRiskSyncArgs,
): UseStatusRiskSyncResult {
  const {
    products,
    risks,
    onProductsChange,
    onRisksChange,
    requestStatusUpdateConfirmation,
  } = args;

  const syncSourceRef = useRef<SyncSource>('user');

  const handleStageStatusChange = useCallback(
    (
      productId: string,
      stageName: string,
      newStatus: StageStatus,
      source: SyncSource = 'user',
    ) => {
      // Always update the stage status (functional updater for stale-closure safety).
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

      // Auto-create risk row only on USER-driven transitions to at-risk/blocked.
      if (source === 'user' && (newStatus === 'at-risk' || newStatus === 'blocked')) {
        const product = products.find((p) => p.id === productId);
        const productName = product?.name ?? 'Unknown';
        const exists = risks.some(
          (r) => r.productId === productId && r.stageName === stageName,
        );

        if (!exists) {
          syncSourceRef.current = 'auto-sync';
          onRisksChange((prev) => [
            ...prev,
            {
              id:
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                  ? crypto.randomUUID()
                  : `risk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              productId,
              productName,
              stageName,
              severity: newStatus === 'blocked' ? 'blocked' : 'at-risk',
              text: '',
            },
          ]);
          syncSourceRef.current = 'user';
        }
      }
    },
    [products, risks, onProductsChange, onRisksChange],
  );

  const handleRiskFilled = useCallback(
    (riskId: string, source: SyncSource = 'user') => {
      // Loop guard: short-circuit auto-sync triggers (Pitfall 5).
      if (source === 'auto-sync') return;

      const risk = risks.find((r) => r.id === riskId);
      if (!risk) return;

      const product = products.find((p) => p.id === risk.productId);
      if (!product) return;

      const stage = product.stages.find((s) => s.stageName === risk.stageName);
      if (!stage) return;

      // Only suggest when the bound stage is not already reflecting a risk.
      if (stage.status === 'on-track' || stage.status === 'empty') {
        requestStatusUpdateConfirmation({
          productId: risk.productId,
          productName: product.name,
          stageName: risk.stageName,
          suggestedStatus: risk.severity,
        });
      }
    },
    [products, risks, requestStatusUpdateConfirmation],
  );

  const applyStatusSuggestion = useCallback(
    (productId: string, stageName: string, status: StageStatus) => {
      syncSourceRef.current = 'auto-sync';
      handleStageStatusChange(productId, stageName, status, 'auto-sync');
      syncSourceRef.current = 'user';
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
