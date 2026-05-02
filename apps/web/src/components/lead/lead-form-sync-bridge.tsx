'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  ConfirmationDialog,
} from '../ui/confirmation-dialog';
import { useStatusRiskSync } from '../../hooks/use-status-risk-sync';
import type { Product, RiskEntry, StageStatus } from './mock-data';
import { RisksSection } from './risks-section';
import { SdlcPipeline } from './sdlc-pipeline';

/**
 * LeadFormSyncBridge — composes useStatusRiskSync with SdlcPipeline + RisksSection.
 *
 * Architecture decision: Provider + sub-components shape.
 * Reason: lead-form.tsx renders the SDLC pipeline and risks list inside two
 * SEPARATE accordion sections, so a single component that emits both children
 * inline cannot be dropped into two different bodies. The Provider holds the
 * sync hook + confirmation dialog state; <Pipeline> and <Risks> are thin
 * consumers that read from React context.
 *
 * Public surface (used by 22-01 lead-form.tsx):
 *   <LeadFormSyncBridge.Provider products={...} risks={...} ...>
 *     ...accordions...
 *       <LeadFormSyncBridge.Pipeline />
 *       ...other accordions...
 *       <LeadFormSyncBridge.Risks />
 *   </LeadFormSyncBridge.Provider>
 */

type SuggestionParams = {
  productId: string;
  productName: string;
  stageName: string;
  suggestedStatus: 'at-risk' | 'blocked';
};

type BridgeContextValue = {
  products: Product[];
  risks: RiskEntry[];
  readOnly: boolean;
  /**
   * Active `ReportSection.id` UUID. Optional because the form may render
   * before the first byPeriod query settles. When defined, child components
   * may use it to wire features that need the section UUID (Phase 31 AI-03
   * `<OnTrackIcon>`).
   */
  sectionId?: string;
  handleStageStatusChange: (
    productId: string,
    stageName: string,
    newStatus: StageStatus,
  ) => void;
  handleRisksChange: (next: RiskEntry[]) => void;
  handleRiskFilled: (riskId: string) => void;
};

const BridgeContext = createContext<BridgeContextValue | null>(null);

function useBridgeContext(componentName: string): BridgeContextValue {
  const ctx = useContext(BridgeContext);
  if (!ctx) {
    throw new Error(
      `${componentName} must be rendered inside <LeadFormSyncBridge.Provider>.`,
    );
  }
  return ctx;
}

export type LeadFormSyncBridgeProviderProps = {
  readonly products: Product[];
  readonly risks: RiskEntry[];
  readonly onProductsChange: (next: Product[]) => void;
  readonly onRisksChange: (next: RiskEntry[]) => void;
  readonly readOnly?: boolean;
  /**
   * Active `ReportSection.id` UUID. Threaded into the bridge so children
   * (notably `Pipeline` -> `SdlcPipeline`) can mount section-scoped AI
   * advisory features without prop-drilling.
   */
  readonly sectionId?: string;
  readonly children: ReactNode;
};

function Provider({
  products,
  risks,
  onProductsChange,
  onRisksChange,
  readOnly = false,
  sectionId,
  children,
}: LeadFormSyncBridgeProviderProps) {
  const [pendingSuggestion, setPendingSuggestion] = useState<SuggestionParams | null>(
    null,
  );

  const requestStatusUpdateConfirmation = useCallback(
    (params: SuggestionParams) => setPendingSuggestion(params),
    [],
  );

  const sync = useStatusRiskSync({
    products,
    risks,
    onProductsChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? (updater as (p: Product[]) => Product[])(products)
          : updater;
      onProductsChange(next);
    },
    onRisksChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? (updater as (r: RiskEntry[]) => RiskEntry[])(risks)
          : updater;
      onRisksChange(next);
    },
    requestStatusUpdateConfirmation,
  });

  const handleStageStatusChange = useCallback(
    (productId: string, stageName: string, newStatus: StageStatus) => {
      if (readOnly) return;
      sync.handleStageStatusChange(productId, stageName, newStatus, 'user');
    },
    [readOnly, sync],
  );

  const handleRisksChange = useCallback(
    (next: RiskEntry[]) => {
      if (readOnly) return;
      // Detect (productId, stageName) tuples that were present in `risks` but
      // have zero remaining entries after this change. For each, reset the
      // matching stage's status back to 'on-track' so the "× Blocked" / risk
      // marker on the SDLC pipeline disappears symmetrically with the
      // existing additive auto-sync (handleStageStatusChange + handleRiskFilled).
      const nextCounts = new Map<string, number>();
      for (const r of next) {
        const key = `${r.productId}::${r.stageName}`;
        nextCounts.set(key, (nextCounts.get(key) ?? 0) + 1);
      }
      const stagesToClear: { productId: string; stageName: string }[] = [];
      const seen = new Set<string>();
      for (const r of risks) {
        const key = `${r.productId}::${r.stageName}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if ((nextCounts.get(key) ?? 0) === 0) {
          stagesToClear.push({ productId: r.productId, stageName: r.stageName });
        }
      }

      onRisksChange(next);

      if (stagesToClear.length > 0) {
        // Reset the affected stages to 'on-track' via the same
        // onProductsChange path the pipeline uses. Only clear stages that
        // are currently flagged at-risk/blocked — leave on-track / empty
        // alone so we don't overwrite an already-clean state.
        const cleared = products.map((p) => {
          const productClears = stagesToClear.filter((s) => s.productId === p.id);
          if (productClears.length === 0) return p;
          return {
            ...p,
            stages: p.stages.map((s) => {
              const hit = productClears.find((c) => c.stageName === s.stageName);
              if (!hit) return s;
              if (s.status === 'at-risk' || s.status === 'blocked') {
                return { ...s, status: 'on-track' as const };
              }
              return s;
            }),
          };
        });
        onProductsChange(cleared);
      }
    },
    [readOnly, onRisksChange, onProductsChange, products, risks],
  );

  const handleRiskFilled = useCallback(
    (riskId: string) => {
      if (readOnly) return;
      sync.handleRiskFilled(riskId, 'user');
    },
    [readOnly, sync],
  );

  const value = useMemo<BridgeContextValue>(
    () => ({
      products,
      risks,
      readOnly,
      ...(sectionId !== undefined ? { sectionId } : {}),
      handleStageStatusChange,
      handleRisksChange,
      handleRiskFilled,
    }),
    [
      products,
      risks,
      readOnly,
      sectionId,
      handleStageStatusChange,
      handleRisksChange,
      handleRiskFilled,
    ],
  );

  return (
    <BridgeContext.Provider value={value}>
      {children}
      {pendingSuggestion && (
        <ConfirmationDialog
          open
          title="Update stage status?"
          description={`A risk was added for ${pendingSuggestion.productName} / ${pendingSuggestion.stageName} stage. Mark this stage as ${pendingSuggestion.suggestedStatus === 'blocked' ? 'Blocked' : 'At Risk'}?`}
          confirmLabel="Update Stage"
          cancelLabel="Skip"
          onConfirm={() => {
            sync.applyStatusSuggestion(
              pendingSuggestion.productId,
              pendingSuggestion.stageName,
              pendingSuggestion.suggestedStatus,
            );
            setPendingSuggestion(null);
          }}
          onClose={() => setPendingSuggestion(null)}
        />
      )}
    </BridgeContext.Provider>
  );
}

function Pipeline() {
  const ctx = useBridgeContext('LeadFormSyncBridge.Pipeline');
  return (
    <SdlcPipeline
      products={ctx.products}
      readOnly={ctx.readOnly}
      onStatusChange={ctx.handleStageStatusChange}
      risks={ctx.risks}
      {...(ctx.sectionId !== undefined ? { sectionId: ctx.sectionId } : {})}
    />
  );
}

function Risks() {
  const ctx = useBridgeContext('LeadFormSyncBridge.Risks');
  // Derive the warning list — stages whose status is at-risk/blocked but
  // have zero risks filled. Computed here so the section stays presentation-
  // only and we don't recompute it for every chip render.
  const unbackedStages: { productId: string; productName: string; stageName: string; severity: 'at-risk' | 'blocked' }[] = [];
  for (const product of ctx.products) {
    for (const stage of product.stages) {
      if (stage.ownership !== 'mine') continue;
      if (stage.status !== 'at-risk' && stage.status !== 'blocked') continue;
      const hasRisk = ctx.risks.some(
        (r) => r.productId === product.id && r.stageName === stage.stageName && (r.text ?? '').trim().length > 0,
      );
      if (!hasRisk) {
        unbackedStages.push({
          productId: product.id,
          productName: product.name,
          stageName: stage.stageName,
          severity: stage.status,
        });
      }
    }
  }
  return (
    <RisksSection
      risks={ctx.risks}
      readOnly={ctx.readOnly}
      onChange={ctx.handleRisksChange}
      onRiskFilled={ctx.handleRiskFilled}
      products={ctx.products}
      unbackedStages={unbackedStages}
    />
  );
}

export const LeadFormSyncBridge = {
  Provider,
  Pipeline,
  Risks,
};

export type LeadFormSyncBridgeContextValue = BridgeContextValue;
