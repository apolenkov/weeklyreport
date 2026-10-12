import { SAFE_TEXT_MAX_LENGTH } from "@weeklyreport/shared";

import { getRequiredProseError } from "../../../shared/ui/forms/record-prose-validation";
import type {
  ParentActivityOption,
  Product,
  RiskEntry,
} from "../../report-sections";
import { canonicalStageNames } from "../../report-sections";

export type RiskSeverity = "at-risk" | "blocked";

export interface RiskFieldErrors {
  parent?: string;
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
    ownedStages.includes(s.stageName),
  );
  if (flagged.some((s) => s.status === "blocked")) return "blocked";
  return "at-risk";
}

export function computeInitialStageNames(
  risk: RiskEntry | null,
  initialStageNames: readonly string[] | undefined,
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
    .filter((stage) => ownedStages.includes(stage.stageName))
    .map((s) => ({
      name: s.stageName,
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
    ...proseError("Risk description", args.text, "text"),
    ...proseError("Impact", args.impact, "impact"),
    ...proseError("Mitigation", args.mitigation, "mitigation"),
    ...(!args.isActivityParent && args.effectiveStageNames.length === 0
      ? { stageNames: "Select at least one stage." }
      : {}),
  };
}

function proseError(
  label: string,
  value: string,
  field: "text" | "impact" | "mitigation",
): RiskFieldErrors {
  const error = getRequiredProseError(value, label, SAFE_TEXT_MAX_LENGTH);
  return error ? { [field]: error } : {};
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

type RiskDialogState =
  | { open: false }
  | {
      open: true;
      mode: "create";
      seedProductId?: string | undefined;
      seedActivityId?: string | undefined;
    }
  | { open: true; mode: "edit"; entity: RiskSaveEntry };

interface RiskDialogCreatePrefill {
  readonly stageNames?: readonly string[] | undefined;
  readonly severity?: RiskSeverity | undefined;
}

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
    productName: args.activityName ?? "Unknown",
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
  dialogState: RiskDialogState,
  createPrefill: RiskDialogCreatePrefill | null,
) {
  if (!dialogState.open) {
    return {
      risk: null,
      defaultProductId: undefined,
      defaultActivityId: undefined,
      initialStageNames: undefined,
      initialSeverity: undefined,
    };
  }

  if (dialogState.mode === "edit") {
    return {
      risk: dialogState.entity,
      defaultProductId: undefined,
      defaultActivityId: undefined,
      initialStageNames: undefined,
      initialSeverity: undefined,
    };
  }

  return {
    risk: null,
    defaultProductId: dialogState.seedProductId,
    defaultActivityId: dialogState.seedActivityId,
    initialStageNames: createPrefill?.stageNames,
    initialSeverity: createPrefill?.severity,
  };
}
