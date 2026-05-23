"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { useStatusRiskSync } from "../../hooks/use-status-risk-sync";
import type { Product, RiskEntry, StageStatus } from "./mock-data";
import { RisksSection } from "./risks-section";
import { SdlcPipeline } from "./sdlc-pipeline";
import type { CrossAuthorEntry } from "./sdlc-pipeline";
import { riskCoversStage, splitStageNames } from "./stage-tags";

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
  suggestedStatus: "at-risk" | "blocked";
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
  /**
   * 35-04: stages-the-lead-owns selector forwarded into RisksSection ->
   * RiskEditDialog so the SDLC stage dropdown is per-project. Optional
   * because the harness used in tests doesn't always feed it.
   */
  stagesForProduct?: (productId: string) => readonly string[];
  /**
   * P5: Display name of the section author. Forwarded into RisksSection
   * for the unified [author …… chip] meta-row.
   */
  sectionAuthorName?: string;
  risksAddSignal?: number;
  /** F1: cross-author entries for the current report period. */
  crossAuthors?: readonly CrossAuthorEntry[];
  /** W5: merged risks (own + foreign) for visual rendering only. The sync hook
   * still operates on `risks` (own-only) to avoid false-positive mutations. */
  displayRisks?: RiskEntry[];
  handleStageStatusChange: (
    productId: string,
    stageName: string,
    newStatus: StageStatus,
  ) => void;
  handleRisksChange: (next: RiskEntry[]) => void;
  handleRiskFilled: (riskId: string) => void;
};

const BridgeContext = createContext<BridgeContextValue | null>(null);

function riskStageKeys(products: Product[], risk: RiskEntry): string[] {
  const tags = splitStageNames(risk.stageName);
  if (tags.length > 0) {
    return tags.map((stageName) => `${risk.productId}::${stageName}`);
  }
  const product = products.find((item) => item.id === risk.productId);
  return (product?.stages ?? []).map(
    (stage) => `${risk.productId}::${stage.stageName}`,
  );
}

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
  /**
   * 35-04: per-project stages-the-lead-owns lookup. Forwarded by the
   * Risks consumer into RiskEditDialog. Optional — tests can omit it.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * P5: Display name of the section author. Forwarded into RisksSection
   * for the unified [author …… chip] meta-row.
   */
  readonly sectionAuthorName?: string;
  readonly risksAddSignal?: number;
  /** F1: cross-author entries for shared products. */
  readonly crossAuthors?: readonly CrossAuthorEntry[];
  /** W5: merged risks for visual rendering; own-only risks drive sync hook. */
  readonly displayRisks?: RiskEntry[];
  readonly children: ReactNode;
};

function Provider({
  products,
  risks,
  onProductsChange,
  onRisksChange,
  readOnly = false,
  sectionId,
  stagesForProduct,
  sectionAuthorName,
  risksAddSignal,
  crossAuthors,
  displayRisks,
  children,
}: LeadFormSyncBridgeProviderProps) {
  const [pendingSuggestion, setPendingSuggestion] =
    useState<SuggestionParams | null>(null);

  const requestStatusUpdateConfirmation = useCallback(
    (params: SuggestionParams) => setPendingSuggestion(params),
    [],
  );

  const sync = useStatusRiskSync({
    products,
    risks,
    onProductsChange: (updater) => {
      const next =
        typeof updater === "function"
          ? (updater as (p: Product[]) => Product[])(products)
          : updater;
      onProductsChange(next);
    },
    onRisksChange: (updater) => {
      const next =
        typeof updater === "function"
          ? (updater as (r: RiskEntry[]) => RiskEntry[])(risks)
          : updater;
      onRisksChange(next);
    },
    requestStatusUpdateConfirmation,
  });

  const handleStageStatusChange = useCallback(
    (productId: string, stageName: string, newStatus: StageStatus) => {
      if (readOnly) return;
      sync.handleStageStatusChange(productId, stageName, newStatus, "user");
    },
    [readOnly, sync],
  );

  const handleRisksChange = useCallback(
    (next: RiskEntry[]) => {
      if (readOnly) return;
      // Strip foreign entries so they don't bleed into draft mutations or
      // skew the stage-clear count (foreign risks belong to other authors).
      const ownNext = next.filter((r) => !r.foreign);
      // Detect (productId, stageName) tuples that were present in `risks` but
      // have zero remaining entries after this change. For each, reset the
      // matching stage's status back to 'on-track' so the "× Blocked" / risk
      // marker on the SDLC pipeline disappears symmetrically with the
      // existing additive auto-sync (handleStageStatusChange + handleRiskFilled).
      const nextCounts = new Map<string, number>();
      for (const r of ownNext) {
        for (const key of riskStageKeys(products, r)) {
          nextCounts.set(key, (nextCounts.get(key) ?? 0) + 1);
        }
      }
      const stagesToClear: { productId: string; stageName: string }[] = [];
      const seen = new Set<string>();
      for (const r of risks) {
        for (const key of riskStageKeys(products, r)) {
          if (seen.has(key)) continue;
          seen.add(key);
          if ((nextCounts.get(key) ?? 0) === 0) {
            const [productId, stageName] = key.split("::");
            if (productId && stageName) {
              stagesToClear.push({ productId, stageName });
            }
          }
        }
      }

      onRisksChange(ownNext);

      if (stagesToClear.length > 0) {
        // Reset the affected stages to 'on-track' via the same
        // onProductsChange path the pipeline uses. Only clear stages that
        // are currently flagged at-risk/blocked — leave on-track / empty
        // alone so we don't overwrite an already-clean state.
        const cleared = products.map((p) => {
          const productClears = stagesToClear.filter(
            (s) => s.productId === p.id,
          );
          if (productClears.length === 0) return p;
          return {
            ...p,
            stages: p.stages.map((s) => {
              const hit = productClears.find(
                (c) => c.stageName === s.stageName,
              );
              if (!hit) return s;
              if (s.status === "at-risk" || s.status === "blocked") {
                return { ...s, status: "on-track" as const };
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
      sync.handleRiskFilled(riskId, "user");
    },
    [readOnly, sync],
  );

  const value = useMemo<BridgeContextValue>(
    () => ({
      products,
      risks,
      readOnly,
      ...(sectionId !== undefined ? { sectionId } : {}),
      ...(stagesForProduct !== undefined ? { stagesForProduct } : {}),
      ...(sectionAuthorName !== undefined ? { sectionAuthorName } : {}),
      ...(risksAddSignal !== undefined ? { risksAddSignal } : {}),
      ...(crossAuthors !== undefined ? { crossAuthors } : {}),
      ...(displayRisks !== undefined ? { displayRisks } : {}),
      handleStageStatusChange,
      handleRisksChange,
      handleRiskFilled,
    }),
    [
      products,
      risks,
      readOnly,
      sectionId,
      stagesForProduct,
      sectionAuthorName,
      risksAddSignal,
      crossAuthors,
      displayRisks,
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
          description={`A risk was added for ${pendingSuggestion.productName} / ${pendingSuggestion.stageName} stage. Mark this stage as ${pendingSuggestion.suggestedStatus === "blocked" ? "Blocked" : "At Risk"}?`}
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

/**
 * Compute the set of stages the lead has marked at-risk/blocked but has
 * not described in the Risks list. The warning banner derived from this
 * set was originally shown above the Risks list, but since it points
 * back at the SDLC chips (where the colour was set) the banner now
 * lives in the Product Status section — same surface, immediate cause
 * → effect link.
 */
function computeUnbackedStages(ctx: ReturnType<typeof useBridgeContext>) {
  const out: {
    productId: string;
    productName: string;
    stageName: string;
    severity: "at-risk" | "blocked";
  }[] = [];
  for (const product of ctx.products) {
    for (const stage of product.stages) {
      if (stage.ownership !== "mine") continue;
      if (stage.status !== "at-risk" && stage.status !== "blocked") continue;
      const hasRisk = ctx.risks.some(
        (r) =>
          r.productId === product.id &&
          riskCoversStage(r, stage.stageName) &&
          (r.text ?? "").trim().length > 0,
      );
      if (!hasRisk) {
        out.push({
          productId: product.id,
          productName: product.name,
          stageName: stage.stageName,
          severity: stage.status,
        });
      }
    }
  }
  return out;
}

function Pipeline() {
  const ctx = useBridgeContext("LeadFormSyncBridge.Pipeline");
  const unbackedStages = computeUnbackedStages(ctx);
  return (
    <SdlcPipeline
      products={ctx.products}
      readOnly={ctx.readOnly}
      onStatusChange={ctx.handleStageStatusChange}
      risks={ctx.risks}
      unbackedStages={unbackedStages}
      {...(ctx.sectionId !== undefined ? { sectionId: ctx.sectionId } : {})}
      {...(ctx.crossAuthors !== undefined
        ? { crossAuthors: ctx.crossAuthors }
        : {})}
    />
  );
}

function Risks() {
  const ctx = useBridgeContext("LeadFormSyncBridge.Risks");
  // displayRisks (own + foreign merged) for visual render; sync hook still
  // uses ctx.risks (own-only) via handleRisksChange to avoid false mutations.
  const renderRisks = ctx.displayRisks ?? ctx.risks;
  return (
    <RisksSection
      risks={renderRisks}
      readOnly={ctx.readOnly}
      onChange={ctx.handleRisksChange}
      onRiskFilled={ctx.handleRiskFilled}
      products={ctx.products}
      {...(ctx.stagesForProduct
        ? { stagesForProduct: ctx.stagesForProduct }
        : {})}
      {...(ctx.sectionAuthorName !== undefined
        ? { sectionAuthorName: ctx.sectionAuthorName }
        : {})}
      {...(ctx.risksAddSignal !== undefined
        ? { addSignal: ctx.risksAddSignal }
        : {})}
    />
  );
}

export const LeadFormSyncBridge = {
  Provider,
  Pipeline,
  Risks,
};

export type LeadFormSyncBridgeContextValue = BridgeContextValue;
