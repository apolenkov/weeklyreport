import type {
  ParentActivityOption,
  Product,
  RiskEntry,
} from "../../report-sections";
import { canonicalStageName, canonicalStageNames } from "../../report-sections";

export type RiskSeverity = "at-risk" | "blocked";

export interface RiskFieldErrors {
  text?: string;
  impact?: string;
  mitigation?: string;
  stageNames?: string;
}

// Called once in useState initializer; never re-run on stage toggles so the
// user's explicit severity choice stays sticky.
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

export function computeInitialStageNames(
  risk: RiskEntry | null,
  initialStageNames: string[] | undefined,
): string[] {
  if (risk?.stageNames) return [...risk.stageNames];
  return initialStageNames ? [...initialStageNames] : [];
}

// Pre-flagged owned stages for a product parent (info strip only). Empty for
// an activity parent, so the strip self-suppresses there.
export function computePreCheckedStages(
  seedProduct: Product | undefined,
  ownedStages: readonly string[],
): { name: string; severity: RiskSeverity }[] {
  return (seedProduct?.stages ?? [])
    .filter(
      (s): s is Product["stages"][number] & { status: RiskSeverity } =>
        s.status === "at-risk" || s.status === "blocked",
    )
    .filter((s) =>
      ownedStages.some(
        (n) => canonicalStageName(n) === canonicalStageName(s.stageName),
      ),
    )
    .map((s) => ({
      name: canonicalStageName(s.stageName),
      severity: s.status,
    }));
}

// Stage required only for a product parent; activities own no stage.
export function collectRiskErrors(args: {
  readonly text: string;
  readonly impact: string;
  readonly mitigation: string;
  readonly isActivityParent: boolean;
  readonly effectiveStageNames: readonly string[];
}): RiskFieldErrors {
  // Only the failing fields get a key, so `Object.keys(...).length === 0`
  // still reads as "valid".
  return {
    ...(args.text.length === 0 ? { text: "Risk description is required" } : {}),
    ...(args.impact.length === 0 ? { impact: "Impact is required" } : {}),
    ...(args.mitigation.length === 0
      ? { mitigation: "Mitigation is required" }
      : {}),
    ...(!args.isActivityParent && args.effectiveStageNames.length === 0
      ? { stageNames: "Select at least one stage." }
      : {}),
  };
}

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

type RiskSaveEntry = RiskEntry & { impact: string; mitigation: string };

// Activity-parented: empty productId, no stage (activities own no SDLC stage).
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
    stageNames: [],
    severity: args.severity,
    text: args.text,
    impact: args.impact,
    mitigation: args.mitigation,
  };
}

export function buildProductRiskEntry(args: {
  readonly existingId: string | undefined;
  readonly product: { id: string; name: string };
  readonly stageNames: readonly string[];
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
    stageNames: canonicalStageNames(args.stageNames),
    severity: args.severity,
    text: args.text,
    impact: args.impact,
    mitigation: args.mitigation,
  };
}

// Map dialog-lifecycle + chip-raise prefill onto RiskEditDialog seed props
// so the section wires the dialog with one spread instead of mode ternaries.
export function deriveRiskDialogSeedProps(
  dialogState:
    | { open: false }
    | {
        open: true;
        mode: "create";
        seedProductId?: string | undefined;
        seedActivityId?: string | undefined;
      }
    | { open: true; mode: "edit"; entity: RiskSaveEntry },
  createPrefill: {
    stageNames?: string[] | undefined;
    severity?: RiskSeverity | undefined;
  } | null,
) {
  const creating = dialogState.open && dialogState.mode === "create";
  const editing = dialogState.open && dialogState.mode === "edit";
  return {
    risk: editing ? dialogState.entity : null,
    defaultProductId: creating ? dialogState.seedProductId : undefined,
    defaultActivityId: creating ? dialogState.seedActivityId : undefined,
    initialStageNames: creating ? createPrefill?.stageNames : undefined,
    initialSeverity: creating ? createPrefill?.severity : undefined,
    initialImpact: editing ? dialogState.entity.impact : "",
    initialMitigation: editing ? dialogState.entity.mitigation : "",
  };
}
