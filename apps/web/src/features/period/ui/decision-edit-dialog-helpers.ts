import { SAFE_TEXT_MAX_LENGTH } from "@customreport/shared";

import { getRequiredProseError } from "../../../shared/ui/forms/record-prose-validation";
import type {
  DecisionEntry,
  ParentActivityOption,
  Product,
} from "../../report-sections";
import { canonicalStageNames } from "../../report-sections";

export interface DecisionFieldErrors {
  text?: string;
  impact?: string;
  stageNames?: string;
}

export function collectDecisionErrors(args: {
  readonly text: string;
  readonly impact: string;
  readonly availableStages: readonly string[];
  readonly effectiveStageNames: readonly string[];
}): DecisionFieldErrors {
  const stageRequired =
    args.availableStages.length > 0 && args.effectiveStageNames.length === 0;
  return {
    ...decisionProseError("Decision text", args.text, "text"),
    ...decisionProseError("Impact", args.impact, "impact"),
    ...(stageRequired ? { stageNames: "Select at least one stage." } : {}),
  };
}

function decisionProseError(
  label: string,
  value: string,
  field: "text" | "impact",
): DecisionFieldErrors {
  const error = getRequiredProseError(value, label, SAFE_TEXT_MAX_LENGTH);
  return error ? { [field]: error } : {};
}

export interface DecisionFormSeed {
  readonly text: string;
  readonly owner: string;
  readonly impact: string;
  readonly deadline: string;
  readonly stageNames: string[];
}

export function resolveDecisionFormSeed(
  decision: DecisionEntry | null,
  defaultOwner: string | undefined,
): DecisionFormSeed {
  if (!decision) {
    return {
      text: "",
      owner: defaultOwner ?? "",
      impact: "",
      deadline: "",
      stageNames: [],
    };
  }

  return {
    text: decision.text,
    // Owner is not user-editable: a decision is always owned by its author —
    // the current lead on create, the saved owner on edit.
    owner: decision.owner,
    impact: decision.impact,
    deadline: decision.deadline ?? "",
    stageNames: [...decision.stageNames],
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
    stageNames: [],
  };
}

// An absent product name stays empty — never a fabricated catch-all label.
export function buildProductDecisionSave(args: {
  readonly base: DecisionSaveBase;
  readonly decision: DecisionEntry | null;
  readonly selectedProduct: Product | undefined;
  readonly parentId: string;
  readonly effectiveStageNames: readonly string[];
}): DecisionEntry {
  return {
    ...args.base,
    productId: args.parentId || "",
    productName: args.selectedProduct?.name ?? args.decision?.productName ?? "",
    activityId: null,
    stageNames: canonicalStageNames(args.effectiveStageNames),
  };
}
