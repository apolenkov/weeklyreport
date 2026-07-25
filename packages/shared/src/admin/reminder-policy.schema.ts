import { z } from "zod";

/** Wire audience tokens (lowercase-hyphen); Prisma SCREAMING_SNAKE is mapped at the API. */
export const reminderAudienceSchema = z.enum([
  "lead-with-draft",
  "head-of-late",
]);

/** Reminder policy kind: deadline, escalation, or follow_up. */
export const reminderPolicyKindSchema = z.enum([
  "deadline",
  "escalation",
  "follow_up",
]);

// Resolvability probe: supportedValuesOf omit UTC/GMT/Etc/* the app itself uses.
const isResolvableTimeZone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

/**
 * Wire reminder policy; `validUntil` must be on or after `validFrom` when set.
 * Timezone must be a resolvable IANA identifier.
 */
export const reminderPolicySchema = z
  .object({
    id: z.uuid(),
    kind: reminderPolicyKindSchema,
    offsetMinutes: z.number().int(),
    timezone: z
      .string()
      .min(1)
      .refine(
        isResolvableTimeZone,
        "timezone must be a valid IANA time zone identifier",
      ),
    audience: reminderAudienceSchema,
    active: z.boolean(),
    // validFrom defaults so older fixtures without the field still parse.
    validFrom: z.coerce.date().default(() => new Date()),
    validUntil: z.coerce.date().nullable().default(null),
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
  );

/** Wire audience token for reminder delivery targeting. */
export type ReminderAudience = z.infer<typeof reminderAudienceSchema>;
/** Reminder policy kind discriminator. */
export type ReminderPolicyKind = z.infer<typeof reminderPolicyKindSchema>;
/** Parsed wire reminder policy. */
export type ReminderPolicy = z.infer<typeof reminderPolicySchema>;
