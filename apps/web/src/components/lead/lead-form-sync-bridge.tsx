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
      onRisksChange(next);
    },
    [readOnly, onRisksChange],
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
      {...(ctx.sectionId !== undefined ? { sectionId: ctx.sectionId } : {})}
    />
  );
}

function Risks() {
  const ctx = useBridgeContext('LeadFormSyncBridge.Risks');
  return (
    <RisksSection
      risks={ctx.risks}
      readOnly={ctx.readOnly}
      onChange={ctx.handleRisksChange}
      onRiskFilled={ctx.handleRiskFilled}
    />
  );
}

export const LeadFormSyncBridge = {
  Provider,
  Pipeline,
  Risks,
};

export type LeadFormSyncBridgeContextValue = BridgeContextValue;
