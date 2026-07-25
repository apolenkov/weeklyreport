import type {
  DecisionEntry,
  ParentActivityOption,
  Product,
} from "../../report-sections";
import { canonicalStageIds } from "../../report-sections";

export interface DecisionFieldErrors {
  text?: string;
  impact?: string;
  stageIds?: string;
}

export function collectDecisionErrors(args: {
  readonly text: string;
  readonly impact: string;
  readonly availableStages: readonly string[];
  readonly effectiveStageIds: readonly string[];
}): DecisionFieldErrors {
  const errors: DecisionFieldErrors = {};
  if (args.text.length === 0) errors.text = "Decision text is required";
  if (args.impact.length === 0) errors.impact = "Impact is required";
  if (args.availableStages.length > 0 && args.effectiveStageIds.length === 0)
    errors.stageIds = "Select at least one stage.";
  return errors;
}

export interface DecisionFormSeed {
  readonly text: string;
  readonly owner: string;
  readonly impact: string;
  readonly deadline: string;
  readonly stageIds: string[];
}

export function resolveDecisionFormSeed(
  decision: DecisionEntry | null,
  defaultOwner: string | undefined,
): DecisionFormSeed {
  return {
    text: decision?.text ?? "",
    // Owner is not user-editable: a decision is always owned by its author —
    // the current lead on create, the saved owner on edit.
    owner: decision?.owner ?? defaultOwner ?? "",
    impact: decision?.impact ?? "",
    deadline: decision?.deadline ?? "",
    stageIds: decision?.stageIds ? [...decision.stageIds] : [],
  };
}

export function resolveDecisionProductName(
  selectedProduct: Product | undefined,
  decision: DecisionEntry | null,
): string {
  return selectedProduct?.name ?? decision?.productName ?? "";
}

interface DecisionSaveBase {
  readonly id: string;
  readonly text: string;
  readonly owner: string;
  readonly impact: string;
  readonly deadline: string | null;
}

export function buildDecisionSaveBase(args: {
  readonly decision: DecisionEntry | null;
  readonly text: string;
  readonly owner: string;
  readonly impact: string;
  readonly deadline: string;
}): DecisionSaveBase {
  return {
    id: args.decision?.id ?? crypto.randomUUID(),
    text: args.text,
    owner: args.owner,
    impact: args.impact,
    deadline: args.deadline ? args.deadline : null,
  };
}

export function buildActivityDecisionSave(args: {
  readonly base: DecisionSaveBase;
  readonly decision: DecisionEntry | null;
  readonly selectedActivity: ParentActivityOption | undefined;
  readonly activityId: string;
}): DecisionEntry {
  const name = args.selectedActivity?.name ?? args.decision?.activityName ?? "";
  return {
    ...args.base,
    productId: "",
    productName: name,
    activityId: args.activityId,
    activityName: name,
    stageIds: undefined,
  };
}

// Legacy parentless product label — matches mapLeadDecisions / DecisionsSection.
const LEGACY_GROUP_PRODUCT_NAME = "Group";

export function buildProductDecisionSave(args: {
  readonly base: DecisionSaveBase;
  readonly decision: DecisionEntry | null;
  readonly selectedProduct: Product | undefined;
  readonly parentId: string;
  readonly effectiveStageIds: readonly string[];
}): DecisionEntry {
  return {
    ...args.base,
    productId: args.parentId || "",
    productName:
      args.selectedProduct?.name ??
      args.decision?.productName ??
      LEGACY_GROUP_PRODUCT_NAME,
    activityId: null,
    stageIds:
      args.effectiveStageIds.length > 0
        ? canonicalStageIds(args.effectiveStageIds)
        : undefined,
  };
}
