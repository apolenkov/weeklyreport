import { z } from "zod";

import { reportDate } from "../primitives/report-primitives.schema";
import { publishedItemReadModelSchema } from "./published-section-record.schema";

const DEFAULT_OPEN_WORK_REPORT_LIMIT = 10;
const MAX_OPEN_WORK_REPORT_LIMIT = 25;

const leadOpenWorkHistoryParentSchema = z
  .object({
    kind: z.enum(["product", "activity"]),
    id: z.uuid(),
    name: z.string().min(1).nullable(),
  })
  .readonly();

/** Selects a bounded page of reports older than the target report. */
export const leadOpenWorkHistoryInputSchema = z
  .object({
    reportId: z.uuid(),
    cursor: z.string().min(1).optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_OPEN_WORK_REPORT_LIMIT)
      .default(DEFAULT_OPEN_WORK_REPORT_LIMIT),
  })
  .readonly();

/** One author-owned item occurrence from an eligible historical section. */
export const leadOpenWorkHistoryOccurrenceSchema = z
  .object({
    source: z.enum(["published", "submitted"]),
    reportId: z.uuid(),
    reportSectionId: z.uuid(),
    periodStart: reportDate(),
    periodEnd: reportDate(),
    parent: leadOpenWorkHistoryParentSchema,
    item: publishedItemReadModelSchema,
  })
  .readonly();

/** A report-keyset page whose eligible sections are flattened to occurrences. */
export const leadOpenWorkHistoryOutputSchema = z
  .object({
    occurrences: z.array(leadOpenWorkHistoryOccurrenceSchema).readonly(),
    nextCursor: z.string().min(1).nullable(),
  })
  .readonly();

/** Raw cursor-page request accepted by `leadForm.openWork`. */
export type LeadOpenWorkHistoryInput = z.input<
  typeof leadOpenWorkHistoryInputSchema
>;
/** One full item occurrence with immutable lineage and source provenance. */
export type LeadOpenWorkHistoryOccurrence = z.infer<
  typeof leadOpenWorkHistoryOccurrenceSchema
>;
/** Bounded historical item occurrences plus an opaque continuation cursor. */
export type LeadOpenWorkHistoryOutput = z.infer<
  typeof leadOpenWorkHistoryOutputSchema
>;
