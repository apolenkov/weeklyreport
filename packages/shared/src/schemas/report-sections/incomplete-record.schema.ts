import { z } from "zod";

import {
  addParentStageIssues,
  addParentXorIssue,
  safeText,
} from "../primitives/report-primitives.schema.js";
import { storedText } from "../primitives/stored-text.schema.js";
import {
  draftSaveSchema,
  MAX_RECORDS_PER_SECTION_SAVE,
} from "./section.schema.js";
import {
  decisionInputSchema,
  decisionReadModelSchema,
  type decisionWriteSchema,
  riskInputSchema,
  riskReadModelSchema,
  type riskWriteSchema,
} from "./section-record.schema.js";

// A draft may leave a detail empty: the form's cleared control (empty or
// whitespace-only) normalises to null. Any other value keeps safeText's
// null-byte, visible-character and length rules, so malformed text is rejected
// rather than silently dropped.
const draftDetailField = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  safeText().nullable(),
);

// Stored details are read as persisted; null marks the detail as missing.
const storedDetailField = storedText().nullable();

interface ParentedRecord {
  readonly activityId?: string | null | undefined;
  readonly stageNames?: readonly string[] | undefined;
}

const addParentIssues = (
  value: ParentedRecord,
  productId: string | null | undefined,
  productPath: "projectId" | "productId",
  ctx: z.RefinementCtx,
): void => {
  if (!addParentXorIssue(productId, value.activityId, productPath, ctx)) {
    return;
  }
  addParentStageIssues(
    productId,
    value.activityId,
    value.stageNames?.length ?? 0,
    ctx,
  );
};

/** Validates a risk draft write whose impact and mitigation may be missing. */
export const draftRiskWriteSchema = riskInputSchema
  .unwrap()
  .extend({ impact: draftDetailField, mitigation: draftDetailField })
  .superRefine((value, ctx) =>
    addParentIssues(value, value.projectId, "projectId", ctx),
  )
  .readonly();

/** Validates a decision draft write whose impact may be missing. */
export const draftDecisionWriteSchema = decisionInputSchema
  .unwrap()
  .extend({ impact: draftDetailField })
  .superRefine((value, ctx) =>
    addParentIssues(value, value.productId, "productId", ctx),
  )
  .readonly();

/** Describes a risk on its author's form, including an incomplete draft. */
export const draftRiskReadModelSchema = z
  .object({
    ...riskReadModelSchema.unwrap().shape,
    impact: storedDetailField,
    mitigation: storedDetailField,
  })
  .superRefine((value, ctx) =>
    addParentIssues(value, value.projectId, "projectId", ctx),
  )
  .readonly();

/** Describes a decision on its author's form, including an incomplete draft. */
export const draftDecisionReadModelSchema = z
  .object({
    ...decisionReadModelSchema.unwrap().shape,
    impact: storedDetailField,
  })
  .superRefine((value, ctx) =>
    addParentIssues(value, value.productId, "productId", ctx),
  )
  .readonly();

/**
 * Accepts a section draft save whose risks and decisions may be incomplete.
 * `draftSaveSchema` and `submitSectionSchema` stay strict: every detail present.
 */
export const incompleteDraftSaveSchema = draftSaveSchema
  .unwrap()
  .extend({
    risks: z
      .array(draftRiskWriteSchema)
      .max(MAX_RECORDS_PER_SECTION_SAVE)
      .readonly(),
    decisions: z
      .array(draftDecisionWriteSchema)
      .max(MAX_RECORDS_PER_SECTION_SAVE)
      .readonly(),
  })
  .readonly();

/** Risk draft as the author's form sends it; details may be null. */
export type DraftRiskWrite = z.infer<typeof draftRiskWriteSchema>;
/** Decision draft as the author's form sends it; impact may be null. */
export type DraftDecisionWrite = z.infer<typeof draftDecisionWriteSchema>;
/** Risk as its author reads it; details may be null. */
export type DraftRiskRecord = z.infer<typeof draftRiskReadModelSchema>;
/** Decision as its author reads it; impact may be null. */
export type DraftDecisionRecord = z.infer<typeof draftDecisionReadModelSchema>;
/** Risk accepted by a strict draft or submit write: every detail present. */
export type SubmittedRiskWrite = z.infer<typeof riskWriteSchema>;
/** Decision accepted by a strict draft or submit write: impact present. */
export type SubmittedDecisionWrite = z.infer<typeof decisionWriteSchema>;
/** Complete risk as public, submitted and published projections carry it. */
export type SubmittedRiskRecord = z.infer<typeof riskReadModelSchema>;
/** Complete decision as public, submitted and published projections carry it. */
export type SubmittedDecisionRecord = z.infer<typeof decisionReadModelSchema>;
/** Section draft save input that may carry incomplete risks and decisions. */
export type IncompleteDraftSaveInput = z.infer<
  typeof incompleteDraftSaveSchema
>;

interface RiskDetails {
  readonly impact: string | null;
  readonly mitigation: string | null;
}

interface DecisionDetails {
  readonly impact: string | null;
}

/**
 * True when a risk carries both details. Completeness is derived from the
 * nulls alone, so it cannot disagree with the stored record.
 */
export const isCompleteRisk = <T extends RiskDetails>(
  risk: T,
): risk is T & { readonly impact: string; readonly mitigation: string } =>
  risk.impact !== null && risk.mitigation !== null;

/** True when a decision carries its impact. */
export const isCompleteDecision = <T extends DecisionDetails>(
  decision: T,
): decision is T & { readonly impact: string } => decision.impact !== null;

/** Splits records into the complete ones and the author-private incomplete ones. */
export const partitionByCompleteness = <T, C extends T>(
  records: readonly T[],
  isComplete: (record: T) => record is C,
): { readonly complete: readonly C[]; readonly incomplete: readonly T[] } => ({
  complete: records.filter(isComplete),
  incomplete: records.filter((record) => !isComplete(record)),
});
