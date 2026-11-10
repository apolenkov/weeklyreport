import { z } from "zod";

import { authorReportSectionReadModelSchema } from "./author-section.schema.js";

/**
 * Describes the reconciled section returned by an item outcome command. It
 * goes back to the author's own form, so it carries their unfinished risks
 * and decisions (a missing detail is null).
 */
export const itemOutcomeResultSchema = z
  .object({
    section: authorReportSectionReadModelSchema,
    stableId: z.uuid(),
    replayed: z.boolean(),
  })
  .readonly();

/** Reconciled result of an idempotent item outcome command. */
export type ItemOutcomeResult = z.infer<typeof itemOutcomeResultSchema>;
