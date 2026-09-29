import { z } from "zod";

import { resolvableTimeZoneSchema } from "../schemas/time-zone.schema";

/** Wire audience tokens (lowercase-hyphen); Prisma SCREAMING_SNAKE is mapped at the API. */
export const reminderAudienceSchema = z.enum([
  "lead-with-draft",
  "head-of-late",
]);

/** Reminder policy kind. */
const reminderPolicyKindSchema = z.enum(["deadline", "escalation"]);

/**
 * Wire reminder policy; `validUntil` must be on or after `validFrom` when set.
 * Timezone must be a resolvable IANA identifier.
 */
export const reminderPolicySchema = z
  .object({
    id: z.uuid(),
    kind: reminderPolicyKindSchema,
    offsetMinutes: z.number().int(),
    timezone: resolvableTimeZoneSchema,
    audience: reminderAudienceSchema,
    active: z.boolean(),
    // Required because deriving a validity boundary from parse time makes the
    // same wire payload change meaning between reads.
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date().nullable().default(null),
  })
  .superRefine((policy, context) => {
    const expectedAudience =
      policy.kind === "deadline" ? "lead-with-draft" : "head-of-late";
    if (policy.audience !== expectedAudience) {
      context.addIssue({
        code: "custom",
        path: ["audience"],
        message: `${policy.kind} policies require the ${expectedAudience} audience`,
      });
    }
  })
  // Wire-level window invariant; UI can be bypassed by a malicious admin client.
  .refine(
    (policy) =>
      policy.validUntil === null ||
      policy.validUntil.getTime() >= policy.validFrom.getTime(),
    {
      message: "validUntil must be on or after validFrom",
      path: ["validUntil"],
    },
  )
  .readonly();

/** Wire audience token for reminder delivery targeting. */
export type ReminderAudience = z.infer<typeof reminderAudienceSchema>;
/** Reminder policy kind discriminator. */
export type ReminderPolicyKind = z.infer<typeof reminderPolicyKindSchema>;
/** Parsed wire reminder policy. */
export type ReminderPolicy = z.infer<typeof reminderPolicySchema>;
