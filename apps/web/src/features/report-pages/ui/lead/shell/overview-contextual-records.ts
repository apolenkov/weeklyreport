import { reportDate, SAFE_TEXT_MAX_LENGTH } from "@weeklyreport/shared";
import { z } from "zod";

import { getRequiredProseError } from "../../../../../shared/ui/forms/record-prose-validation";
import {
  buildActivityDecisionSave,
  buildDecisionSaveBase,
  buildProductDecisionSave,
  collectDecisionErrors,
} from "../../../../period";
import type {
  DecisionInput,
  Parent,
  Product,
  RiskInput,
} from "../../../../report-sections";
import {
  buildActivityRiskEntry,
  buildProductRiskEntry,
  collectRiskErrors,
} from "../../../../review";

type EligibleParent = Parent & { readonly product?: Product };
interface Context {
  readonly parent: Parent;
  readonly eligibleParents: readonly EligibleParent[];
  readonly eligibleStages: readonly string[];
  readonly identity: { readonly id: string; readonly stableId: string };
}
type Errors = Record<string, string>;
type Result<T> =
  | { readonly ok: true; readonly record: T }
  | { readonly ok: false; readonly errors: Errors };

function validateContext(
  args: Context,
  stages: readonly string[],
): { errors: Errors; parent: EligibleParent | undefined } {
  const parent = args.eligibleParents.find(
    (item) => item.kind === args.parent.kind && item.id === args.parent.id,
  );
  const errors: Errors = {};
  if (
    !parent?.name.trim() ||
    !parent.id.trim() ||
    (parent.kind === "product" && parent.product?.id !== parent.id)
  )
    errors.parent = "Parent is no longer eligible.";
  if (
    !z.uuid().safeParse(args.identity.id).success ||
    !z.uuid().safeParse(args.identity.stableId).success
  )
    errors.identity = "A valid record and stable identity are required.";
  if (
    args.parent.kind === "activity"
      ? stages.length > 0
      : stages.length === 0 ||
        stages.some((stage) => !args.eligibleStages.includes(stage))
  )
    errors.stageNames = "Select currently eligible stages for this parent.";
  return { errors, parent };
}

export function prepareContextualRisk(
  args: Context & { readonly input: RiskInput },
): Result<ReturnType<typeof buildProductRiskEntry>> {
  const input = {
    ...args.input,
    impact: args.input.impact ?? "",
    mitigation: args.input.mitigation ?? "",
  };
  const { errors, parent } = validateContext(args, args.input.stageNames);
  Object.assign(
    errors,
    collectRiskErrors({
      ...input,
      detailsOptional: true,
      isActivityParent: args.parent.kind === "activity",
      effectiveStageNames: args.input.stageNames,
    }),
  );
  if (
    !(["at-risk", "blocked"] as readonly string[]).includes(args.input.severity)
  )
    errors.severity = "Select a severity.";
  if (Object.keys(errors).length > 0 || !parent) return { ok: false, errors };
  const common = {
    existingId: args.identity.id,
    stableId: args.identity.stableId,
    ...input,
  };
  const record =
    parent.kind === "activity"
      ? buildActivityRiskEntry({
          ...common,
          activityId: parent.id,
          activityName: parent.name,
        })
      : buildProductRiskEntry({
          ...common,
          product: { id: parent.id, name: parent.name },
        });
  return { ok: true, record };
}

export function prepareContextualDecision(
  args: Context & {
    readonly input: DecisionInput;
    readonly authorName: string;
  },
): Result<ReturnType<typeof buildProductDecisionSave>> {
  const input = { ...args.input, impact: args.input.impact ?? "" };
  const { errors, parent } = validateContext(args, args.input.stageNames);
  Object.assign(
    errors,
    collectDecisionErrors({
      ...input,
      impactOptional: true,
      availableStages: args.eligibleStages,
      effectiveStageNames: args.input.stageNames,
    }),
  );
  const authorError = getRequiredProseError(
    args.authorName,
    "Author",
    SAFE_TEXT_MAX_LENGTH,
  );
  if (authorError) errors.authorName = authorError;
  if (
    args.input.deadline &&
    !reportDate().safeParse(args.input.deadline).success
  )
    errors.deadline = "Enter a valid deadline.";
  if (Object.keys(errors).length > 0 || !parent) return { ok: false, errors };
  const base = buildDecisionSaveBase({
    decision: null,
    ...args.identity,
    ...input,
    owner: args.authorName,
  });
  const record =
    parent.kind === "activity"
      ? buildActivityDecisionSave({
          base,
          decision: null,
          selectedActivity: parent,
          activityId: parent.id,
        })
      : buildProductDecisionSave({
          base,
          decision: null,
          selectedProduct: parent.product,
          parentId: parent.id,
          effectiveStageNames: args.input.stageNames,
        });
  return { ok: true, record };
}
