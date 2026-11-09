import { z } from "zod";

import { reportDate } from "../primitives/report-primitives.schema.js";
import {
  draftDecisionReadModelSchema,
  draftRiskReadModelSchema,
  isCompleteDecision,
  isCompleteRisk,
} from "./incomplete-record.schema.js";

/**
 * Selects one source section for private recovery. The caller names only the
 * report and the section: authorship comes from the authenticated actor, so
 * the input has no author field and rejects unknown keys.
 */
export const retainedIncompleteRecordsInputSchema = z
  .strictObject({
    reportId: z.uuid(),
    reportSectionId: z.uuid(),
  })
  .readonly();

/**
 * Why recovery shows a source read-only. `reopened`: the source is editable
 * again, but only through the normal form.
 */
export const retainedReadOnlyReasonSchema = z.enum([
  "published",
  "archived",
  "not-current",
  "reopened",
]);

/**
 * Unfinished records an author's source section holds now. It is a current
 * count, not a publication fact: it shrinks when the author completes or
 * deletes a draft, and is absent when recovery has nothing to show.
 */
export const retainedDraftCountsSchema = z
  .strictObject({
    risks: z.number().int().nonnegative(),
    decisions: z.number().int().nonnegative(),
    readOnlyReason: retainedReadOnlyReasonSchema,
  })
  .refine((counts) => counts.risks + counts.decisions > 0, {
    message: "Retained draft counts name at least one record.",
  })
  .readonly();

const NOT_INCOMPLETE = "Recovery returns incomplete records only.";

// Recovery is a read of the source text. Comments stay with the source and
// the stable identity is required so the view can key its rows.
const retainedRiskSchema = z
  .strictObject({
    ...draftRiskReadModelSchema.unwrap().shape,
    stableId: z.uuid(),
    comments: z.never().optional(),
  })
  .refine((risk) => !isCompleteRisk(risk), { message: NOT_INCOMPLETE })
  .readonly();

const retainedDecisionSchema = z
  .strictObject({
    ...draftDecisionReadModelSchema.unwrap().shape,
    stableId: z.uuid(),
    comments: z.never().optional(),
  })
  .refine((decision) => !isCompleteDecision(decision), {
    message: NOT_INCOMPLETE,
  })
  .readonly();

/**
 * The author's retained incomplete records of one source section, read-only.
 * `unavailable` covers a missing, removed or inaccessible source alike and
 * carries no content. The available shape is strict: it names the source and
 * why it is read-only, and has no field that could grant an edit or a reopen.
 */
export const retainedIncompleteRecordsOutputSchema = z.discriminatedUnion(
  "status",
  [
    z.strictObject({ status: z.literal("unavailable") }).readonly(),
    z
      .strictObject({
        status: z.literal("available"),
        reportId: z.uuid(),
        reportSectionId: z.uuid(),
        periodStart: reportDate(),
        periodEnd: reportDate(),
        readOnlyReason: retainedReadOnlyReasonSchema,
        risks: z.array(retainedRiskSchema).readonly(),
        decisions: z.array(retainedDecisionSchema).readonly(),
      })
      .readonly(),
  ],
);

/** Report and section that identify one private recovery read. */
export type RetainedIncompleteRecordsInput = z.infer<
  typeof retainedIncompleteRecordsInputSchema
>;
/** Private recovery result: the retained records or an empty denial. */
export type RetainedIncompleteRecordsOutput = z.infer<
  typeof retainedIncompleteRecordsOutputSchema
>;
/** Why a recovery source is read-only. */
export type RetainedReadOnlyReason = z.infer<
  typeof retainedReadOnlyReasonSchema
>;
/** Current unfinished-record counts of one own source section. */
export type RetainedDraftCounts = z.infer<typeof retainedDraftCountsSchema>;
