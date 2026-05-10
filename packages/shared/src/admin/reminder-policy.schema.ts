import { z } from "zod";

/**
 * UFB-036 (Phase 44-02): Wire-format schema for ReminderPolicy.
 *
 * The Prisma model uses a screaming-snake `ReminderAudience` enum
 * (`LEAD_WITH_DRAFT | HEAD_OF_LATE`) on the database side. The wire/zod
 * contract uses the lowercase-hyphen form so the React admin UI stays
 * idiomatic and consistent with the rest of the shared schema vocabulary
 * (e.g. `traffic-light` statuses). The repository layer (apps/api)
 * translates between the two via `audienceFromPrisma` / `audienceToPrisma`
 * mappers; this module is the single source of truth for the wire shape.
 *
 * `kind` mirrors the Prisma `ReminderRuleKind` enum verbatim
 * (`deadline | follow_up | escalation`) — those values already use
 * snake_case in the database, so no mapping is needed for that field.
 */
export const reminderAudienceSchema = z.enum([
  "lead-with-draft",
  "head-of-late",
]);

export const reminderPolicyKindSchema = z.enum([
  "deadline",
  "escalation",
  "follow_up",
]);

export const reminderPolicySchema = z.object({
  id: z.string().uuid(),
  kind: reminderPolicyKindSchema,
  offsetMinutes: z.number().int(),
  timezone: z.string().min(1),
  audience: reminderAudienceSchema,
  active: z.boolean(),
});

export type ReminderAudience = z.infer<typeof reminderAudienceSchema>;
export type ReminderPolicyKind = z.infer<typeof reminderPolicyKindSchema>;
export type ReminderPolicy = z.infer<typeof reminderPolicySchema>;
