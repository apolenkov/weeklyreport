import { z } from "zod";

import { organizationPublicSchema } from "../organization/organization";

// 'escalation' fires the T+2h heads-only digest and bypasses
// User.notificationOptOut because heads must always be notified.
/** Reminder rule categories stored by the admin scheduler. */
export const adminReminderRuleKindSchema = z.enum(["deadline", "escalation"]);

/** Administrative lifecycle of a generated reminder rule. */
export const adminReminderRuleStatusSchema = z.enum(["active", "paused"]);

/** Validates one generated reminder rule and its owning report and policy. */
export const adminReminderRuleSchema = z
  .object({
    id: z.uuid(),
    reportId: z.uuid(),
    policyId: z.uuid(),
    kind: adminReminderRuleKindSchema,
    fireAt: z.coerce.date(),
    timezone: z.string().min(1),
    status: adminReminderRuleStatusSchema,
    version: z.number().int().min(1),
  })
  .readonly();

/** Recovery-only rule identity, including its immutable schedule basis. */
export const adminSnapshotReminderRuleSchema = adminReminderRuleSchema
  .and(z.object({ deadline: z.coerce.date() }))
  .readonly();

/** Delivery lifecycle recorded for one reminder execution. */
export const adminReminderExecutionStatusSchema = z.enum([
  "queued",
  "sending",
  "sent",
  "failed",
]);

/** Renderer data persisted with a deadline reminder execution. */
export const reminderDeadlinePayloadSchema = z
  .object({
    kind: z.literal("deadline"),
    cycleDate: z.iso.date(),
    leadName: z.string().min(1),
    reportPeriod: z.string().min(1),
    deadlineIso: z.iso.datetime(),
    sectionUrl: z.url(),
    organization: organizationPublicSchema,
  })
  .strict();

/** Renderer data persisted with an escalation reminder execution. */
export const reminderEscalationPayloadSchema = z
  .object({
    kind: z.literal("escalation"),
    cycleDate: z.iso.date(),
    headName: z.string().min(1),
    reportPeriod: z.string().min(1),
    lateLeads: z
      .array(
        z
          .object({
            leadName: z.string().min(1),
            sectionTitle: z.string().min(1),
            deadlineIso: z.iso.datetime(),
          })
          .strict(),
      )
      .min(1),
    organization: organizationPublicSchema,
  })
  .strict();

/** Exact current renderer snapshot stored in ReminderExecution.queuePayload. */
export const reminderQueuePayloadSchema = z.discriminatedUnion("kind", [
  reminderDeadlinePayloadSchema
    .extend({ contractVersion: z.literal(1) })
    .strict(),
  reminderEscalationPayloadSchema
    .extend({ contractVersion: z.literal(1) })
    .strict(),
]);

const adminReminderExecutionFields = {
  id: z.uuid(),
  ruleId: z.uuid(),
  reportId: z.uuid(),
  dedupeKey: z.string().min(1),
  status: adminReminderExecutionStatusSchema,
  scheduledFor: z.coerce.date(),
  sentAt: z.coerce.date().nullable(),
  recipientEmail: z.email(),
  errorMessage: z
    .string()
    .min(1)
    .refine((message) => message.trim().length > 0, {
      message: "Reminder failure message must contain non-whitespace text.",
    })
    .nullable(),
} as const;

interface ReminderLifecycleTuple {
  readonly status: z.infer<typeof adminReminderExecutionStatusSchema>;
  readonly sentAt: Date | null;
  readonly errorMessage: string | null;
}

function validateReminderLifecycleTuple(
  execution: ReminderLifecycleTuple,
  context: z.RefinementCtx,
): void {
  const valid =
    execution.status === "sent"
      ? execution.sentAt !== null && execution.errorMessage === null
      : execution.status === "failed"
        ? execution.sentAt === null && execution.errorMessage !== null
        : execution.sentAt === null && execution.errorMessage === null;
  if (!valid) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message:
        "Reminder execution status, sentAt, and errorMessage must form one coherent lifecycle outcome.",
    });
  }
}

/** Validates one scheduled reminder delivery attempt. */
export const adminReminderExecutionSchema = z
  .object(adminReminderExecutionFields)
  .superRefine(validateReminderLifecycleTuple)
  .readonly();

/** Lifecycle-complete reminder delivery row used only by snapshot recovery. */
export const adminSnapshotReminderExecutionSchema = z
  .object({
    ...adminReminderExecutionFields,
    queuePayload: reminderQueuePayloadSchema,
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  })
  .superRefine(validateReminderLifecycleTuple)
  .readonly();

/** Scheduler rule with lifecycle state and required report and policy owners. */
export type AdminReminderRule = z.infer<typeof adminReminderRuleSchema>;
/** Rule version with the immutable deadline required for exact recovery. */
export type AdminSnapshotReminderRule = z.infer<
  typeof adminSnapshotReminderRuleSchema
>;
/** One reminder delivery attempt and its observable outcome. */
export type AdminReminderExecution = z.infer<
  typeof adminReminderExecutionSchema
>;
/** Reminder delivery row with renderer payload and persistence timestamps. */
export type AdminSnapshotReminderExecution = z.infer<
  typeof adminSnapshotReminderExecutionSchema
>;
/** Immutable renderer payload stored with one reminder execution. */
export type ReminderQueuePayload = z.infer<typeof reminderQueuePayloadSchema>;
