import { z } from "zod";

/** Counts manual reminder requests without claiming completed email delivery. */
export const reminderDispatchResultSchema = z
  .object({
    queued: z.number().int().nonnegative(),
    alreadyRequested: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    reason: z.string().optional(),
  })
  .readonly();

/** Manual reminder outcomes, including failures within a partial batch. */
export type ReminderDispatchResult = z.infer<
  typeof reminderDispatchResultSchema
>;
