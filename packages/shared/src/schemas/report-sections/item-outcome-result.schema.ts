import { z } from "zod";

import { reportSectionReadModelSchema } from "./section.schema.js";

/** Describes the reconciled section returned by an item outcome command. */
export const itemOutcomeResultSchema = z
  .object({
    section: reportSectionReadModelSchema,
    stableId: z.uuid(),
    replayed: z.boolean(),
  })
  .readonly();

/** Reconciled result of an idempotent item outcome command. */
export type ItemOutcomeResult = z.infer<typeof itemOutcomeResultSchema>;
