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
import type { CrossAuthorEntry } from "../../period";
import { SdlcPipeline } from "../../period";
import {
  type Product,
  type RiskEntry,
  type StageStatus,
} from "../../report-sections";
import { RisksSection } from "../../review";
import {
  annotateOwnRiskCoverage,
  applyRiskSeverityFloor,
  coveringRisksForStage,
} from "./lead-form-risk-coverage";

// A chip whose displayed severity is floored by a covering risk cannot author
// or lower that status. The lead changes an at-risk or blocked stage by editing
// its risk in the Risks section.
const COVERED_STAGE_HINT_MESSAGE =
  "This stage's status comes from a covering risk. Resolve it in Risks & Blockers to change the stage.";

// Provider + Pipeline/Risks consumers: pipeline and risks live in separate
// accordion bodies, so one component cannot emit both inline.

/**
 * Payload of a chip-raise interception, carried through context into
 * RisksSection so each `signal` increment opens a prefilled RiskEditDialog.
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
  /** Attached activities forwarded into the risk parent picker. */
  activities?: readonly { id: string; name: string }[];
  /**
   * Stages-the-lead-owns selector forwarded into RisksSection and
   * RiskEditDialog so the SDLC stage dropdown is per-project. Optional
   * because the harness used in tests doesn't always feed it.
   */
  stagesForProduct?: (productId: string) => readonly string[];
  /**
   * Display name of the section author, forwarded into RisksSection for the
   * unified author meta-row.
   */
  sectionAuthorName?: string;
  risksAddSignal?: number;
  /** Cross-author entries for the current report period. */
  crossAuthors?: readonly CrossAuthorEntry[];
  /**
   * The record visibility mode, forwarded to SdlcPipeline so Mine renders only
   * the lead's own stage chips. Optional —
   * tests / non-lead callers omit it and the pipeline defaults to "everyone".
   */
  visibilityMode?: "mine" | "everyone";
  /** Merged risks (own + foreign) for visual rendering only. The sync hook
   * still operates on `risks` (own-only) to avoid false-positive mutations. */
  displayRisks?: RiskEntry[];
  /** Pending chip-raise prefill for RisksSection's create dialog. */
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

interface LeadFormSyncBridgeProviderProps {
  readonly products: Product[];
  readonly risks: RiskEntry[];
  readonly onProductsChange: (next: Product[]) => void;
  readonly onRisksChange: (next: RiskEntry[]) => void;
  readonly readOnly?: boolean;
  /** Attached activities forwarded into the risk parent picker. */
  readonly activities?: readonly { id: string; name: string }[];
  /**
   * Per-project stages-the-lead-owns lookup, forwarded by the Risks consumer
   * into RiskEditDialog. Optional because tests can omit it.
   */
  readonly stagesForProduct?: (productId: string) => readonly string[];
  /**
   * Display name of the section author, forwarded into RisksSection for the
   * unified author meta-row.
   */
  readonly sectionAuthorName?: string;
  readonly risksAddSignal?: number;
  /** Cross-author entries for shared products. */
  readonly crossAuthors?: readonly CrossAuthorEntry[];
  /**
   * Record visibility mode forwarded to the pipeline. Optional — defaults to
   * "everyone" (full grid) when omitted.
   */
  readonly visibilityMode?: "mine" | "everyone";
  /** Merged risks for rendering; own-only risks drive the sync hook. */
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
  // RisksSection consumes the chip-raise payload. Sharing it with the external
  // quick-add and item-alarm channel keeps one canonical dialog-open source.
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
  const sync = useStatusRiskSync({
    onProductsChange: (updater) => {
      const next = typeof updater === "function" ? updater(products) : updater;
      onProductsChange(next);
    },
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
      sync.handleStageStatusChange(productId, stageName, newStatus);
    },
    [readOnly, sync, risks],
  );

  const handleRisksChange = useCallback(
    (next: RiskEntry[]) => {
      if (readOnly) return;
      // Strip foreign entries so they don't bleed into draft mutations
      // (foreign risks belong to other authors).
      const ownNext = next.filter((r) => !r.foreign);

      // Never persist derived stage status — write-through corrupts completeness.
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
  // Re-derive coverage: products stay stable across an in-session risk add.
  const rawWithCoverage = annotateOwnRiskCoverage(ctx.products, ctx.risks);
  // Apply the same render-time severity floor as mapLeadProducts so live chips
  // cannot show on-track or empty while covering risks exist, and an orphan severity
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
