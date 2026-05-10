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

export const reminderPolicySchema = z
  .object({
    id: z.string().uuid(),
    kind: reminderPolicyKindSchema,
    offsetMinutes: z.number().int(),
    timezone: z.string().min(1),
    audience: reminderAudienceSchema,
    active: z.boolean(),
    /**
     * UFB-036 (Phase 44 scope-extension): validity window for the policy.
     * `validFrom` defaults to "now" so older fixtures (and the in-memory
     * test repos) that emit policies without this field still parse — the
     * schema fills the value rather than rejecting. `validUntil === null`
     * means the policy is active forever (the UI "forever" checkbox).
     *
     * Use `z.coerce.date()` so the wire JSON (ISO string) round-trips into
     * a JS Date without a separate transform step at every call site.
     */
    validFrom: z.coerce.date().default(() => new Date()),
    validUntil: z.coerce.date().nullable().default(null),
  })
  /**
   * UFB-036 (Phase 44-05): the validity window must be coherent. The UI
   * already disables Save when `validUntil < validFrom`, but a malicious
   * admin client could bypass the React layer; the wire-level refine
   * guarantees the invariant holds at the API boundary too.
   */
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
