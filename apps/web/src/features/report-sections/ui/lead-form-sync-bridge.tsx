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

import { useStatusRiskSync } from "../../../hooks/use-status-risk";
import { deriveEffectiveStageStatus } from "../../../lib/stage-status";
import type { CrossAuthorEntry } from "../../period";
import { SdlcPipeline } from "../../period";
import { RisksSection } from "../../review";
import { riskCoversStage } from "../model/stage-tags";
import type { Product, RiskEntry, StageStatus } from "../model/types";

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
 * Render-time severity floor for the live lead form. Every "mine" stage is
 * routed through `deriveEffectiveStageStatus` — the same rule `mapLeadProducts`
 * applies in the read model, so the live form, head review, and export agree.
 *
 * simplify-stage-status-interaction (D3, council find C): the derivation runs
 * UNCONDITIONALLY, not only for stages with a covering risk. A covering risk
 * floors the chip UP to its severity; a stage whose raw status is at-risk/blocked
 * but has NO covering risk collapses DOWN to on-track — matching the read model,
 * which already collapses it. This is also the migration for legacy explicit
 * at-risk/blocked stage rows: they render On Track on next load, no backfill.
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
      const floored = deriveEffectiveStageStatus(stage.status, covering, []);
      return floored === stage.status ? stage : { ...stage, status: floored };
    }),
  }));
}

/**
 * Render-time twin of the mapper's
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

// simplify-stage-status-interaction (D1/D2): clicking a chip whose displayed
// severity is floored by a covering risk (own or foreign) no longer authors or
// lowers the status — the chip is a plain On Track/unset toggle. The lead
// changes an at-risk/blocked stage by editing its risk in the Risks section.
const COVERED_STAGE_HINT_MESSAGE =
  "This stage's status comes from a covering risk. Resolve it in Risks & Blockers to change the stage.";

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
  /**
   * Set by an activity pill's unbacked raise: the create dialog opens with
   * this activity preselected as the parent (XOR — `productId` is "" and
   * `stageIds` empty on activity prefills).
   */
  activityId?: string;
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
  const sync = useStatusRiskSync({
    onProductsChange: (updater) => {
      const next = typeof updater === "function" ? updater(products) : updater;
      onProductsChange(next);
    },
  });

  const handleStageStatusChange = useCallback(
    (productId: string, stageName: string, newStatus: StageStatus) => {
      if (readOnly) return;
      // simplify-stage-status-interaction (D1/D2): the chip is a plain On
      // Track/unset toggle. An OWN covering risk floors the chip's displayed
      // severity, and the chip no longer authors or lowers it — so a click on a
      // floored chip changes nothing and points the lead at the Risks section,
      // where the risk is the single lever. Only own risks floor the live chip
      // (`applyRiskSeverityFloor` runs on own risks), so the block gates on own
      // coverage alone: a foreign risk lives in another lead's section, never
      // floors this chip, and this lead cannot resolve it here anyway. An
      // uncovered chip applies the toggle straight through.
      const coveringOwn = coveringRisksForStage(risks, productId, stageName);
      if (coveringOwn.length > 0) {
        toast.info(COVERED_STAGE_HINT_MESSAGE);
        return;
      }
      sync.handleStageStatusChange(productId, stageName, newStatus, "user");
    },
    [readOnly, sync, risks],
  );

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

  return (
    <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>
  );
}

function Pipeline() {
  const ctx = useBridgeContext("LeadFormSyncBridge.Pipeline");
  // rethink-pipeline-state-vs-completeness: the "unbacked stage" warning is
  // gone — status is derived from risks, so a chip cannot be at-risk/blocked
  // without a backing risk.
  // W11: re-derive coveredByOwnRisk from the live risks (ctx.products is stable
  // across an in-session risk add, so its mapper-baked flag is stale). The
  // counter reads this off rawProducts; the chip reads it off the floored array.
  const rawWithCoverage = annotateOwnRiskCoverage(ctx.products, ctx.risks);
  // simplify-stage-status-interaction (D3): render-time severity floor — the
  // same rule as mapLeadProducts, so the live chips can never show
  // on-track/empty while covering risks exist, and an orphan explicit severity
  // collapses to on-track exactly as the read model does.
  const flooredProducts = applyRiskSeverityFloor(rawWithCoverage, ctx.risks);
  return (
    <SdlcPipeline
      products={flooredProducts}
      rawProducts={rawWithCoverage}
      readOnly={ctx.readOnly}
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
