"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { canonicalStageName, riskCoversStage } from "./stage-tags";

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
 * W11 (fix-report-surface-integrity): render-time twin of the mapper's
 * `coveredByOwnRisk` annotation. `ctx.products` is stable across an in-session
 * risk add (no refetch), so the mapper-baked flag goes stale the moment the lead
 * stages a risk; re-deriving it here from the live `risks` lets the completeness
 * counter tick without a reload. Strict, like the mapper: only an OWN non-empty
 * risk that EXPLICITLY names the stage (non-empty stageIds) sets the flag — a
 * covers-all (`[]`) or legacy stage-less risk does not, so it never inflates the
 * counter. Foreign risks (other productId) never set it. Exported for testing.
 */
export function annotateOwnRiskCoverage(
  products: readonly Product[],
  risks: readonly RiskEntry[],
): Product[] {
  return products.map((product) => ({
    ...product,
    stages: product.stages.map((stage) => {
      if (stage.ownership !== "mine") return stage;
      const covered = risks.some(
        (r) =>
          r.productId === product.id &&
          r.text.trim().length > 0 &&
          Array.isArray(r.stageIds) &&
          r.stageIds.length > 0 &&
          riskCoversStage(r, stage.stageName),
      );
      return stage.coveredByOwnRisk === covered
        ? stage
        : { ...stage, coveredByOwnRisk: covered };
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
  /** activity-first-class: attached activities forwarded into the risk parent picker. */
  activities?: readonly { id: string; name: string }[];
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
  /**
   * lead-mine-hide-unowned-stages: the record visibility mode, forwarded to
   * SdlcPipeline so Mine renders only the lead's own stage chips. Optional —
   * tests / non-lead callers omit it and the pipeline defaults to "everyone".
   */
  visibilityMode?: "mine" | "everyone";
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
  /** activity-first-class: attached activities forwarded into the risk parent picker. */
  readonly activities?: readonly { id: string; name: string }[];
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
  /**
   * lead-mine-hide-unowned-stages: record visibility mode forwarded to the
   * pipeline. Optional — defaults to "everyone" (full grid) when omitted.
   */
  readonly visibilityMode?: "mine" | "everyone";
  /** W5: merged risks for visual rendering; own-only risks drive sync hook. */
  readonly displayRisks?: RiskEntry[];
  /**
   * A one-shot risk-prefill routed from OUTSIDE the pipeline — the quick-add
   * "Blocker" entry (severity blocked) and the item dialog's alarm gesture
   * (product + stage + severity). Threaded through the same create-dialog
   * channel the chip-raise interception uses; each new `signal` opens once.
   */
  readonly externalRiskPrefill?: RiskPrefillRequest | null;
  readonly children: ReactNode;
}

function Provider({
  products,
  risks,
  onProductsChange,
  onRisksChange,
  readOnly = false,
  activities,
  stagesForProduct,
  sectionAuthorName,
  risksAddSignal,
  crossAuthors,
  visibilityMode,
  displayRisks,
  externalRiskPrefill,
  children,
}: LeadFormSyncBridgeProviderProps) {
  // D2: chip-raise interception payload, consumed by RisksSection. Shared with
  // the external prefill channel (quick-add "Blocker" / item-dialog alarm) so a
  // single create-dialog open source stays canonical.
  const [riskPrefill, setRiskPrefill] = useState<RiskPrefillRequest | null>(
    null,
  );

  // Fold an external one-shot prefill into the same channel. The external
  // source (`externalRiskPrefill`) lives in the PERSISTENT parent (lead-form),
  // while this Provider remounts on the slides<->edit toggle. Seed the guard ref
  // from the mount-time signal and open only on a strict increase, so a remount
  // that re-reads a still-set stale prefill does NOT reopen the dialog (the D16
  // stale-signal fix, mirrored from `useEditableListDialog`); a genuine later
  // quick-add still advances past it and opens.
  const lastExternalSignal = useRef(externalRiskPrefill?.signal ?? 0);
  useEffect(() => {
    if (!externalRiskPrefill) return;
    if (externalRiskPrefill.signal <= lastExternalSignal.current) return;
    lastExternalSignal.current = externalRiskPrefill.signal;
    setRiskPrefill(externalRiskPrefill);
  }, [externalRiskPrefill]);
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
      // Strip foreign entries so they don't bleed into draft mutations
      // (foreign risks belong to other authors).
      const ownNext = next.filter((r) => !r.foreign);

      // rethink-pipeline-state-vs-completeness: adding or removing a risk MUST
      // NOT persist a derived status onto the stages. The displayed severity is
      // a pure render-time derivation of the covering risks (applyRiskSeverityFloor
      // on the live form, mapLeadProducts in the read model), so there is no
      // separate persisted manual status that can drift. The earlier
      // unify-risk-stage-status write-through (promote on add, clear on remove)
      // corrupted completeness: an add-then-remove cycle left empty stages
      // persisted as on-track, falsely satisfying "my input is complete".
      onRisksChange(ownNext);
    },
    [readOnly, onRisksChange],
  );

  const value = useMemo<BridgeContextValue>(
    () => ({
      products,
      risks,
      readOnly,
      ...(activities !== undefined ? { activities } : {}),
      ...(stagesForProduct !== undefined ? { stagesForProduct } : {}),
      ...(sectionAuthorName !== undefined ? { sectionAuthorName } : {}),
      ...(risksAddSignal !== undefined ? { risksAddSignal } : {}),
      ...(crossAuthors !== undefined ? { crossAuthors } : {}),
      ...(visibilityMode !== undefined ? { visibilityMode } : {}),
      ...(displayRisks !== undefined ? { displayRisks } : {}),
      riskPrefill,
      handleStageStatusChange,
      handleRisksChange,
    }),
    [
      products,
      risks,
      readOnly,
      activities,
      stagesForProduct,
      sectionAuthorName,
      risksAddSignal,
      crossAuthors,
      visibilityMode,
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

function Pipeline() {
  const ctx = useBridgeContext("LeadFormSyncBridge.Pipeline");
  // rethink-pipeline-state-vs-completeness: the "unbacked stage" warning is
  // gone — status is derived from risks, so a chip cannot be at-risk/blocked
  // without a backing risk. The chip-raise interception in
  // handleStageStatusChange is what enforces that, so the warning has nothing
  // left to warn about.
  // W11: re-derive coveredByOwnRisk from the live risks (ctx.products is stable
  // across an in-session risk add, so its mapper-baked flag is stale). The
  // counter reads this off rawProducts; the chip reads it off the floored array.
  const rawWithCoverage = annotateOwnRiskCoverage(ctx.products, ctx.risks);
  // D1: render-time severity floor — same rule as mapLeadProducts, so the
  // live chips can never show on-track/empty while covering risks exist.
  const flooredProducts = applyRiskSeverityFloor(rawWithCoverage, ctx.risks);
  // Menu hint twin of handleStageStatusChange's raise interception: a raise
  // with no sufficient covering risk (blocked needs a blocked risk, at-risk
  // any covering risk) routes to risk creation, so the menu says so.
  const riskGapForStage = (productId: string, stageName: string) => {
    const covering = coveringRisksForStage(ctx.risks, productId, stageName);
    return {
      "at-risk": covering.length === 0,
      blocked: !covering.some((r) => r.severity === "blocked"),
    };
  };
  return (
    <SdlcPipeline
      products={flooredProducts}
      rawProducts={rawWithCoverage}
      readOnly={ctx.readOnly}
      riskGapForStage={riskGapForStage}
      onStatusChange={ctx.handleStageStatusChange}
      {...(ctx.crossAuthors !== undefined
        ? { crossAuthors: ctx.crossAuthors }
        : {})}
      {...(ctx.visibilityMode !== undefined
        ? { visibilityMode: ctx.visibilityMode }
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
      {...(ctx.activities ? { activities: ctx.activities } : {})}
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
