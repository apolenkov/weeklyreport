import { z } from "zod";

import {
  draftDecisionReadModelSchema,
  draftRiskReadModelSchema,
} from "./incomplete-record.schema.js";
import { reportSectionReadModelObjectSchema } from "./section.schema.js";

/**
 * A section as its own author reads it: risks and decisions may still miss
 * their details. Every other reader gets `reportSectionReadModelSchema`, which
 * rejects a missing detail, so an incomplete record cannot leave this shape by
 * accident.
 */
export const authorReportSectionReadModelSchema =
  reportSectionReadModelObjectSchema
    .extend({
      risks: z.array(draftRiskReadModelSchema).readonly(),
      decisions: z.array(draftDecisionReadModelSchema).readonly(),
    })
    .readonly();

/** Author-private section state; risk and decision details may be null. */
export type AuthorReportSectionReadModel = z.infer<
  typeof authorReportSectionReadModelSchema
>;
