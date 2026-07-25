import { z } from "zod";

// Wire audience is lowercase-hyphen; Prisma uses SCREAMING_SNAKE — API mappers translate.
export const reminderAudienceSchema = z.enum([
  "lead-with-draft",
  "head-of-late",
]);

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

export type ReminderAudience = z.infer<typeof reminderAudienceSchema>;
export type ReminderPolicyKind = z.infer<typeof reminderPolicyKindSchema>;
export type ReminderPolicy = z.infer<typeof reminderPolicySchema>;
