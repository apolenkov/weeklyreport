"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { useStatusRiskSync } from "../../hooks/use-status-risk";
import { deriveEffectiveStageStatus } from "../../lib/stage-status";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
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
 * Own non-empty risks of `productId` that cover `stageName`
 * (unify-risk-stage-status: coverage uses the canonical `riskCoversStage`
 * predicate — same as `computeUnbackedStages`). Exported for unit testing.
 */
export function coveringRisksForStage(
  risks: readonly RiskEntry[],
  productId: string,
  stageName: string,
): RiskEntry[] {
  return risks.filter(
    (r) =>
      r.productId === productId &&
      r.text.trim().length > 0 &&
      riskCoversStage(r, stageName),
  );
}

/**
 * unify-risk-stage-status (D1): render-time severity floor. Every "mine"
 * stage covered by a non-empty own risk renders at least at the risk's
 * severity (blocked > at-risk) — the same rule `mapLeadProducts` applies in
 * the read model, so the live form, head review, and export agree.
 * Exported for unit testing.
 */
export function applyRiskSeverityFloor(
  products: readonly Product[],
  risks: readonly RiskEntry[],
): Product[] {
  return products.map((product) => ({
    ...product,
    stages: product.stages.map((stage) => {
      if (stage.ownership !== "mine") return stage;
      const covering = coveringRisksForStage(
        risks,
        product.id,
        stage.stageName,
      );
      if (covering.length === 0) return stage;
      const floored = deriveEffectiveStageStatus(stage.status, covering, []);
      return floored === stage.status ? stage : { ...stage, status: floored };
    }),
  }));
}

/**
 * unify-risk-stage-status (D3): apply a confirmed chip lowering to the risk
 * list. Each covering risk either loses the clicked stage (it covers other
 * stages too — surviving risks keep >=1 stage, so sibling chips keep their
 * floor) or is deleted (the clicked stage was its only stage; legacy rows
 * without explicit stageIds count as single-coverage and are deleted —
 * stripping cannot be expressed on an implicit "all stages" scope).
 * Exported for unit testing.
 */
export function removeStageFromCoveringRisks(
  risks: readonly RiskEntry[],
  coveringIds: ReadonlySet<string>,
  stageName: string,
): RiskEntry[] {
  const clicked = canonicalStageName(stageName);
  return risks.flatMap((r) => {
    if (!coveringIds.has(r.id)) return [r];
    const remaining = (r.stageIds ?? []).filter(
      (id) => canonicalStageName(id) !== clicked,
    );
    if (remaining.length === 0) return [];
    return [{ ...r, stageIds: remaining }];
  });
}

/** Counts how the D3 confirmation will affect the covering risks. */
export function describeLowerEffects(
  coveringRisks: readonly RiskEntry[],
  stageName: string,
): { deletions: number; strips: number } {
  const clicked = canonicalStageName(stageName);
  const deletions = coveringRisks.filter((r) =>
    (r.stageIds ?? []).every((id) => canonicalStageName(id) === clicked),
  ).length;
  return { deletions, strips: coveringRisks.length - deletions };
}

const CROSS_AUTHOR_LOWER_BLOCKED_MESSAGE =
  "This stage is covered by another lead's risk. Resolve it with them before lowering the status.";

const BLOCKED_FLOOR_LOWER_MESSAGE =
  "This stage is blocked by a covering risk. Downgrade or delete that risk to lower the stage to at-risk.";

function pluralizeRisks(count: number): string {
  return `${count} risk${count === 1 ? "" : "s"}`;
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

/**
 * unify-risk-stage-status (D2): payload of a chip-raise interception.
 * Carried through context into RisksSection, which opens RiskEditDialog in
 * create mode prefilled with it on every `signal` increment.
 */
export interface RiskPrefillRequest {
  /** Monotonic counter — a new dialog open per increment. */
  signal: number;
  productId: string;
  stageIds: string[];
  severity: "at-risk" | "blocked";
}

/** unify-risk-stage-status (D3): pending confirmed-removal state. */
interface PendingLower {
  productId: string;
  productName: string;
  stageName: string;
  newStatus: "on-track" | "empty";
  coveringRisks: RiskEntry[];
}

interface BridgeContextValue {
  products: Product[];
  risks: RiskEntry[];
  readOnly: boolean;
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
  /** D2: pending chip-raise prefill for RisksSection's create dialog. */
  riskPrefill: RiskPrefillRequest | null;
  handleStageStatusChange: (
    productId: string,
    stageName: string,
    newStatus: StageStatus,
  ) => void;
  handleRisksChange: (next: RiskEntry[]) => void;
}

const BridgeContext = createContext<BridgeContextValue | null>(null);

function riskStageKeys(products: Product[], risk: RiskEntry): string[] {
  const tags =
    risk.stageIds ??
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
    splitStageNames(risk.stageName);
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

export interface LeadFormSyncBridgeProviderProps {
  readonly products: Product[];
  readonly risks: RiskEntry[];
  readonly onProductsChange: (next: Product[]) => void;
  readonly onRisksChange: (next: RiskEntry[]) => void;
  readonly readOnly?: boolean;
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
}

function Provider({
  products,
  risks,
  onProductsChange,
  onRisksChange,
  readOnly = false,
  stagesForProduct,
  sectionAuthorName,
  risksAddSignal,
  crossAuthors,
  displayRisks,
  children,
}: LeadFormSyncBridgeProviderProps) {
  // D2: chip-raise interception payload, consumed by RisksSection.
  const [riskPrefill, setRiskPrefill] = useState<RiskPrefillRequest | null>(
    null,
  );
  // D3: chip-lower interception awaiting user confirmation.
  const [pendingLower, setPendingLower] = useState<PendingLower | null>(null);

  const sync = useStatusRiskSync({
    onProductsChange: (updater) => {
      const next = typeof updater === "function" ? updater(products) : updater;
      onProductsChange(next);
    },
  });

  const handleStageStatusChange = useCallback(
    (productId: string, stageName: string, newStatus: StageStatus) => {
      if (readOnly) return;
      const coveringOwn = coveringRisksForStage(risks, productId, stageName);
      if (newStatus === "at-risk" || newStatus === "blocked") {
        // D1/D3 guard: "at-risk" on a chip floored to blocked by a covering
        // blocked risk is a lowering below the floor, not a raise. Applying
        // it would persist an explicit status that silently disagrees with
        // the rendered (derived) status, so block it and point at the risk
        // list — mirroring the cross-author lowering rule below.
        if (
          newStatus === "at-risk" &&
          coveringOwn.some((r) => r.severity === "blocked")
        ) {
          toast.error(BLOCKED_FLOOR_LOWER_MESSAGE);
          return;
        }
        // D2: a chip click is never the only record of a risk. Same
        // sufficiency predicate as computeUnbackedStages: blocked needs a
        // blocked risk, at-risk accepts any non-empty covering risk.
        const hasSufficientRisk =
          newStatus === "blocked"
            ? coveringOwn.some((r) => r.severity === "blocked")
            : coveringOwn.length > 0;
        if (!hasSufficientRisk) {
          // Do NOT apply the status — route through risk creation. The
          // explicit status lands on dialog save via the up-flow promotion
          // in handleRisksChange; on cancel nothing changed, so no rollback.
          setRiskPrefill((prev) => ({
            signal: (prev?.signal ?? 0) + 1,
            productId,
            stageIds: [stageName],
            severity: newStatus,
          }));
          return;
        }
      } else {
        // D3: lowering a covered chip routes through confirmed risk removal.
        const coveringForeign = (displayRisks ?? []).filter(
          (r) =>
            r.foreign === true &&
            r.productId === productId &&
            r.text.trim().length > 0 &&
            riskCoversStage(r, stageName),
        );
        if (coveringForeign.length > 0) {
          // Cross-author coverage: a lead cannot delete another lead's risk.
          toast.error(CROSS_AUTHOR_LOWER_BLOCKED_MESSAGE);
          return;
        }
        if (coveringOwn.length > 0) {
          const product = products.find((p) => p.id === productId);
          setPendingLower({
            productId,
            productName: product?.name ?? productId,
            stageName,
            newStatus,
            coveringRisks: coveringOwn,
          });
          return;
        }
      }
      sync.handleStageStatusChange(productId, stageName, newStatus, "user");
    },
    [readOnly, sync, risks, displayRisks, products],
  );

  const confirmLower = useCallback(() => {
    if (!pendingLower) return;
    const coveringIds = new Set(pendingLower.coveringRisks.map((r) => r.id));
    onRisksChange(
      removeStageFromCoveringRisks(risks, coveringIds, pendingLower.stageName),
    );
    // Apply the chip status through the auto-sync source so it bypasses the
    // interception above (the risks state is still pre-removal this frame).
    sync.applyStatusSuggestion(
      pendingLower.productId,
      pendingLower.stageName,
      pendingLower.newStatus,
    );
    setPendingLower(null);
  }, [pendingLower, risks, onRisksChange, sync]);

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

  const value = useMemo<BridgeContextValue>(
    () => ({
      products,
      risks,
      readOnly,
      ...(stagesForProduct !== undefined ? { stagesForProduct } : {}),
      ...(sectionAuthorName !== undefined ? { sectionAuthorName } : {}),
      ...(risksAddSignal !== undefined ? { risksAddSignal } : {}),
      ...(crossAuthors !== undefined ? { crossAuthors } : {}),
      ...(displayRisks !== undefined ? { displayRisks } : {}),
      riskPrefill,
      handleStageStatusChange,
      handleRisksChange,
    }),
    [
      products,
      risks,
      readOnly,
      stagesForProduct,
      sectionAuthorName,
      risksAddSignal,
      crossAuthors,
      displayRisks,
      riskPrefill,
      handleStageStatusChange,
      handleRisksChange,
    ],
  );

  const lowerEffects = pendingLower
    ? describeLowerEffects(pendingLower.coveringRisks, pendingLower.stageName)
    : null;
  const lowerConsequenceParts = lowerEffects
    ? [
        lowerEffects.deletions > 0
          ? `Deletes ${pluralizeRisks(lowerEffects.deletions)}`
          : null,
        lowerEffects.strips > 0
          ? `Removes this stage from ${pluralizeRisks(lowerEffects.strips)}`
          : null,
      ].filter(Boolean)
    : [];
  const lowerConsequence =
    lowerConsequenceParts.length > 0
      ? `${lowerConsequenceParts.join("; ")}.`
      : null;

  return (
    <BridgeContext.Provider value={value}>
      {children}
      {pendingLower && (
        <ConfirmDeleteDialog
          open
          title={
            pendingLower.newStatus === "empty"
              ? "Clear this stage?"
              : "Set stage back to on-track?"
          }
          preview={`${pendingLower.productName} · ${pendingLower.stageName}`}
          subtitle="Risks are the record of at-risk/blocked work, so lowering the stage removes its covering risks."
          {...(lowerConsequence ? { consequence: lowerConsequence } : {})}
          confirmLabel="Lower status"
          onConfirm={confirmLower}
          onCancel={() => setPendingLower(null)}
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
          r.text.trim().length > 0 &&
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
  // D1: render-time severity floor — same rule as mapLeadProducts, so the
  // live chips can never show on-track/empty while covering risks exist.
  const flooredProducts = applyRiskSeverityFloor(ctx.products, ctx.risks);
  return (
    <SdlcPipeline
      products={flooredProducts}
      readOnly={ctx.readOnly}
      onStatusChange={ctx.handleStageStatusChange}
      unbackedStages={unbackedStages}
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
      {...(ctx.riskPrefill ? { addPrefill: ctx.riskPrefill } : {})}
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
