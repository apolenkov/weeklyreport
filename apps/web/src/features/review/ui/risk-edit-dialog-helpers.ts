import type {
  ParentActivityOption,
  Product,
  RiskEntry,
} from "../../report-sections";
import { canonicalStageIds, canonicalStageName } from "../../report-sections";

export type RiskSeverity = "at-risk" | "blocked";

export interface RiskFieldErrors {
  text?: string;
  impact?: string;
  mitigation?: string;
  stageIds?: string;
}

/**
 * Derives initial severity from pipeline-flagged stages.
 * Called ONCE in useState initializer; never re-run on stage checkbox toggles
 * so the user's explicit severity choice is sticky.
 */
export function deriveFromPreChecked(
  product: Product | undefined,
  ownedStages: readonly string[],
): RiskSeverity {
  const flagged = (product?.stages ?? []).filter((s) =>
    ownedStages.some(
      (n) => canonicalStageName(n) === canonicalStageName(s.stageName),
    ),
  );
  if (flagged.some((s) => s.status === "blocked")) return "blocked";
  return "at-risk";
}

/** Computes which stage IDs to pre-select on dialog open. */
export function computeInitialStageIds(
  risk: RiskEntry | null,
  initialStageIds: string[] | undefined,
): string[] {
  if (risk?.stageIds) return [...risk.stageIds];
  return initialStageIds ? [...initialStageIds] : [];
}

/**
 * The context strip's pre-flagged owned stages for a product parent: the
 * product's at-risk/blocked stages the current lead owns. Empty for an activity
 * parent (no seed product), which is why the strip self-suppresses there.
 */
export function computePreCheckedStages(
  seedProduct: Product | undefined,
  ownedStages: readonly string[],
): { name: string; severity: RiskSeverity }[] {
  return (seedProduct?.stages ?? [])
    .filter((s) => s.status === "at-risk" || s.status === "blocked")
    .filter((s) =>
      ownedStages.some(
        (n) => canonicalStageName(n) === canonicalStageName(s.stageName),
      ),
    )
    .map((s) => ({
      name: canonicalStageName(s.stageName),
      severity: s.status as RiskSeverity,
    }));
}

/**
 * Per-field validation for the risk save. A stage is required only for a
 * product parent; an activity owns no stage, so it is never demanded there.
 */
export function collectRiskErrors(args: {
  readonly text: string;
  readonly impact: string;
  readonly mitigation: string;
  readonly isActivityParent: boolean;
  readonly effectiveStageIds: readonly string[];
}): RiskFieldErrors {
  const errors: RiskFieldErrors = {};
  if (args.text.length === 0) errors.text = "Risk description is required";
  if (args.impact.length === 0) errors.impact = "Impact is required";
  if (args.mitigation.length === 0)
    errors.mitigation = "Mitigation is required";
  if (!args.isActivityParent && args.effectiveStageIds.length === 0)
    errors.stageIds = "Select at least one stage.";
  return errors;
}

/** The parent's display name for the header — the activity or the product. */
export function resolveRiskParentName(args: {
  readonly isActivityParent: boolean;
  readonly selectedActivity: ParentActivityOption | undefined;
  readonly products: readonly Product[];
  readonly parentId: string;
  readonly risk: RiskEntry | null;
}): string {
  if (args.isActivityParent) return args.selectedActivity?.name ?? "";
  const product = args.products.find((p) => p.id === args.parentId);
  if (product) return product.name;
  return args.risk?.productId === args.parentId ? args.risk.productName : "";
}

/**
 * Resolve the product a product-parented save writes to. A cross-stage row may
 * reference a project outside the lead's stage-owned `products`, so keep the
 * original assignment instead of silently reassigning to the first product.
 */
export function resolveRiskSaveProduct(
  products: readonly Product[],
  risk: RiskEntry | null,
  parentId: string,
): { id: string; name: string } | undefined {
  return (
    products.find((p) => p.id === parentId) ??
    (risk?.productId === parentId
      ? { id: risk.productId, name: risk.productName }
      : products.at(0))
  );
}

type RiskSaveEntry = RiskEntry & { impact: string; mitigation: string };

/**
 * Builds the save payload for an activity-parented risk: empty productId, no
 * stage — an activity owns no SDLC stage (Decision 5).
 */
export function buildActivityRiskEntry(args: {
  readonly existingId: string | undefined;
  readonly activityId: string;
  readonly activityName: string | undefined;
  readonly severity: RiskSeverity;
  readonly text: string;
  readonly impact: string;
  readonly mitigation: string;
}): RiskSaveEntry {
  return {
    id: args.existingId ?? crypto.randomUUID(),
    productId: "",
    productName: args.activityName ?? "",
    activityId: args.activityId,
    activityName: args.activityName,
    stageIds: [],
    severity: args.severity,
    text: args.text,
    impact: args.impact,
    mitigation: args.mitigation,
  };
}

/** Builds the save payload for a product-parented risk. */
export function buildProductRiskEntry(args: {
  readonly existingId: string | undefined;
  readonly product: { id: string; name: string };
  readonly stageIds: readonly string[];
  readonly severity: RiskSeverity;
  readonly text: string;
  readonly impact: string;
  readonly mitigation: string;
}): RiskSaveEntry {
  return {
    id: args.existingId ?? crypto.randomUUID(),
    productId: args.product.id,
    productName: args.product.name,
    activityId: null,
    stageIds: canonicalStageIds(args.stageIds),
    severity: args.severity,
    text: args.text,
    impact: args.impact,
    mitigation: args.mitigation,
  };
}

/**
 * Maps the shared dialog-lifecycle state (+ the caller-side chip-raise
 * prefill) onto RiskEditDialog's seed props, so the section component wires
 * the dialog with one spread instead of seven mode ternaries.
 */
export function deriveRiskDialogSeedProps(
  dialogState:
    | { open: false }
    | {
        open: true;
        mode: "create";
        seedProductId?: string;
        seedActivityId?: string;
      }
    | { open: true; mode: "edit"; entity: RiskSaveEntry },
  createPrefill: {
    stageIds?: string[];
    severity?: RiskSeverity;
  } | null,
) {
  const creating = dialogState.open && dialogState.mode === "create";
  const editing = dialogState.open && dialogState.mode === "edit";
  return {
    risk: editing ? dialogState.entity : null,
    defaultProductId: creating ? dialogState.seedProductId : undefined,
    defaultActivityId: creating ? dialogState.seedActivityId : undefined,
    initialStageIds: creating ? createPrefill?.stageIds : undefined,
    initialSeverity: creating ? createPrefill?.severity : undefined,
    initialImpact: editing ? dialogState.entity.impact : "",
    initialMitigation: editing ? dialogState.entity.mitigation : "",
  };
}
