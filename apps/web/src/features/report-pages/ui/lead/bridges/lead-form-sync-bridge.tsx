"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { CrossAuthorEntry } from "../../../../period";
import { SdlcPipeline } from "../../../../period";
import {
  annotateOwnRiskCoverage,
  applyRiskSeverityFloor,
  coveringRisksForStage,
  type DraftPatch,
  type Product,
  type RiskEntry,
  type RiskPrefillRequest,
  type StageStatus,
} from "../../../../report-sections";
export type { RiskPrefillRequest } from "../../../../report-sections";
import { useStatusRiskSync } from "../../../../report-sections/client";
import { RisksSection } from "../../../../review";
import {
  BridgeContext,
  type BridgeContextValue,
  type StagesForProduct,
  useBridgeContext,
} from "./lead-form-sync-context";

// A chip whose displayed severity is floored by a covering risk cannot author
// or lower that status. The lead changes an at-risk or blocked stage by editing
// its risk in the Risks section.
const COVERED_STAGE_HINT_MESSAGE =
  "This stage's status comes from a covering risk. Resolve it in Risks & Blockers to change the stage.";
// A foreign risk only colors the chip; the lead's own status change still
// applies and autosave persists it, so the hint explains why the chip does not
// visibly change. It claims no save: autosave owns that status.
const FOREIGN_COVERED_STAGE_HINT_MESSAGE =
  "Another lead's risk keeps this stage colored until that risk is resolved.";

// Provider + Pipeline/Risks consumers: pipeline and risks live in separate
// accordion bodies, so one component cannot emit both inline.

// Chip-raise payload routed into RisksSection: each `signal` increment opens
// exactly one prefilled RiskEditDialog.
export type { StagesForProduct } from "./lead-form-sync-context";

interface LeadFormSyncBridgeProviderProps {
  readonly products: readonly Product[];
  readonly risks: readonly RiskEntry[];
  readonly onProductsChange: (
    next: Extract<DraftPatch, { readonly kind: "products" }>["products"],
  ) => void;
  readonly onRisksChange: (next: readonly RiskEntry[]) => void;
  readonly readOnly?: boolean | undefined;
  readonly activities?: readonly { id: string; name: string }[] | undefined;
  readonly stagesForProduct?: StagesForProduct | undefined;
  readonly sectionAuthorName?: string | undefined;
  readonly risksAddSignal?: number | undefined;
  readonly crossAuthors?: readonly CrossAuthorEntry[] | undefined;
  // Omitted defaults to "everyone" (full grid); "mine" renders only the
  // lead's own stage chips.
  readonly visibilityMode?: "mine" | "everyone" | undefined;
  // Merged risks for rendering only — the sync hook still runs on own-only
  // `risks` to avoid false-positive mutations.
  readonly displayRisks?: readonly RiskEntry[] | undefined;
  // One-shot prefill routed from outside the pipeline; each new `signal`
  // opens the create dialog exactly once.
  readonly externalRiskPrefill?: RiskPrefillRequest | null | undefined;
  readonly children: ReactNode;
}

// RisksSection consumes the chip-raise payload. Sharing it with the external
// quick-add and item-alarm channel keeps one canonical dialog-open source.
function useExternalRiskPrefill(
  externalRiskPrefill: RiskPrefillRequest | null | undefined,
): RiskPrefillRequest | null {
  const [riskPrefill, setRiskPrefill] = useState<RiskPrefillRequest | null>(
    null,
  );

  // Open only on signal increase so slides↔edit remounts don't reopen stale prefills.
  const lastExternalSignal = useRef(externalRiskPrefill?.signal ?? 0);
  useEffect(() => {
    if (!externalRiskPrefill) return;
    if (externalRiskPrefill.signal <= lastExternalSignal.current) return;
    lastExternalSignal.current = externalRiskPrefill.signal;
    setRiskPrefill(externalRiskPrefill);
  }, [externalRiskPrefill]);

  return riskPrefill;
}

type BridgeHandlers = Pick<
  BridgeContextValue,
  "handleStageStatusChange" | "handleRisksChange"
>;

function useBridgeHandlers(
  props: LeadFormSyncBridgeProviderProps,
): BridgeHandlers {
  const {
    risks,
    displayRisks,
    readOnly = false,
    onProductsChange,
    onRisksChange,
  } = props;

  const sync = useStatusRiskSync({
    onProductsChange,
  });

  const handleStageStatusChange = useCallback(
    (productId: string, stageName: string, newStatus: StageStatus) => {
      if (readOnly) return;
      // Floored chips point at Risks; only own covering risks block the toggle.
      const coveringOwn = coveringRisksForStage(risks, productId, stageName);
      if (coveringOwn.length > 0) {
        toast.info(COVERED_STAGE_HINT_MESSAGE);
        return;
      }
      const foreignRisks = (displayRisks ?? []).filter((r) => r.foreign);
      if (
        coveringRisksForStage(foreignRisks, productId, stageName).length > 0
      ) {
        toast.info(FOREIGN_COVERED_STAGE_HINT_MESSAGE);
      }
      sync.handleStageStatusChange(productId, stageName, newStatus);
    },
    [readOnly, sync, risks, displayRisks],
  );

  const handleRisksChange = useCallback(
    (next: readonly RiskEntry[]) => {
      if (readOnly) return;
      // Strip foreign entries so they don't bleed into draft mutations
      // (foreign risks belong to other authors).
      const ownNext = next.filter((r) => !r.foreign);

      // Never persist derived stage status — write-through corrupts completeness.
      onRisksChange(ownNext);
    },
    [readOnly, onRisksChange],
  );

  return { handleStageStatusChange, handleRisksChange };
}

// Include optional context fields only when they have values, matching the
// context's exact optional-property types.
function useBridgeContextValue(
  props: LeadFormSyncBridgeProviderProps,
  riskPrefill: RiskPrefillRequest | null,
  { handleStageStatusChange, handleRisksChange }: BridgeHandlers,
): BridgeContextValue {
  const {
    products,
    risks,
    readOnly = false,
    activities,
    stagesForProduct,
    sectionAuthorName,
    risksAddSignal,
    crossAuthors,
    visibilityMode,
    displayRisks,
  } = props;

  return useMemo<BridgeContextValue>(
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
}

function Provider(props: LeadFormSyncBridgeProviderProps) {
  const riskPrefill = useExternalRiskPrefill(props.externalRiskPrefill);
  const handlers = useBridgeHandlers(props);
  const value = useBridgeContextValue(props, riskPrefill, handlers);

  return (
    <BridgeContext.Provider value={value}>
      {props.children}
    </BridgeContext.Provider>
  );
}

function Pipeline() {
  const ctx = useBridgeContext("LeadFormSyncBridge.Pipeline");
  // Re-derive coverage: products stay stable across an in-session risk add.
  const rawWithCoverage = annotateOwnRiskCoverage(ctx.products, ctx.risks);
  // Apply the same render-time severity floor as mapLeadProducts so live chips
  // cannot show on-track or empty while covering risks exist, and an orphan severity
  // collapses to on-track exactly as the read model does.
  // Display floor includes foreign risks shown in Everyone mode (color only);
  // coverage and the toggle guard stay on own risks.
  const flooredProducts = applyRiskSeverityFloor(
    rawWithCoverage,
    ctx.displayRisks ?? ctx.risks,
  );
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
