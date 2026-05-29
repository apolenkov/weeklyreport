"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useStatusRiskSync } from "../../hooks/use-status-risk";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import type { Product, RiskEntry, StageStatus } from "./mock-data";
import { RisksSection } from "./risks-section";
import type { CrossAuthorEntry } from "./sdlc-pipeline";
import { SdlcPipeline } from "./sdlc-pipeline";
import {
  canonicalStageName,
  riskCoversStage,
  splitStageNames,
} from "./stage-tags";

/**
 * Promotes a stage status based on a risk's severity.
 * Never downgrades: if the stage is already blocked, it stays blocked.
 * Exported for unit testing.
 */
export function promoteStageStatus(
  current: StageStatus,
  riskSeverity: "at-risk" | "blocked",
): StageStatus {
  if (current === "blocked") return "blocked";
  if (riskSeverity === "blocked") return "blocked";
  if (current === "at-risk") return "at-risk";
  return riskSeverity; // "on-track" + "at-risk" → "at-risk"
}

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
  const tags =
    risk.stageIds !== undefined
      ? risk.stageIds
      : splitStageNames(risk.stageName);
  if (tags.length > 0) {
    return tags.map(
      (stageName) => `${risk.productId}::${canonicalStageName(stageName)}`,
    );
  }
  const product = products.find((item) => item.id === risk.productId);
  return (product?.stages ?? []).map(
    (stage) => `${risk.productId}::${canonicalStageName(stage.stageName)}`,
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

      // Count risks per canonical stage key after this change.
      const nextCounts = new Map<string, number>();
      for (const r of ownNext) {
        for (const key of riskStageKeys(products, r)) {
          nextCounts.set(key, (nextCounts.get(key) ?? 0) + 1);
        }
      }

      // Stages to clear: had risks before, now have none → reset to on-track.
      const stagesToClear = new Set<string>();
      const seen = new Set<string>();
      for (const r of risks) {
        for (const key of riskStageKeys(products, r)) {
          if (seen.has(key)) continue;
          seen.add(key);
          if ((nextCounts.get(key) ?? 0) === 0) {
            stagesToClear.add(key);
          }
        }
      }

      // Up-flow promotion: surviving risks promote their stages up, never down.
      // locked-ownership stages are excluded (owned by the product head, not this lead).
      const stagePromotions = new Map<string, "at-risk" | "blocked">();
      for (const r of ownNext) {
        for (const key of riskStageKeys(products, r)) {
          if (stagesToClear.has(key)) continue;
          const current = stagePromotions.get(key);
          if (current === "blocked") continue;
          stagePromotions.set(
            key,
            r.severity === "blocked" ? "blocked" : "at-risk",
          );
        }
      }

      onRisksChange(ownNext);

      const hasProductChanges =
        stagesToClear.size > 0 || stagePromotions.size > 0;
      if (!hasProductChanges) return;

      const updatedProducts = products.map((p) => ({
        ...p,
        stages: p.stages.map((s) => {
          if (s.ownership === "locked") return s;
          const key = `${p.id}::${canonicalStageName(s.stageName)}`;
          if (stagesToClear.has(key)) {
            return s.status === "at-risk" || s.status === "blocked"
              ? { ...s, status: "on-track" as const }
              : s;
          }
          const target = stagePromotions.get(key);
          if (target) {
            const promoted = promoteStageStatus(s.status, target);
            return promoted !== s.status ? { ...s, status: promoted } : s;
          }
          return s;
        }),
      }));
      onProductsChange(updatedProducts);
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
      // A blocked stage requires a blocked risk; an at-risk risk alone
      // does not justify marking a stage as blocked.
      const hasMatchingRisk = ctx.risks.some(
        (r) =>
          r.productId === product.id &&
          riskCoversStage(r, stage.stageName) &&
          (r.text ?? "").trim().length > 0 &&
          (stage.status === "at-risk" || r.severity === "blocked"),
      );
      if (!hasMatchingRisk) {
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
