import { z } from "zod";

import { reminderPolicySchema } from "../../admin/reminder-policy.schema";
import { roleSchema } from "../auth/auth";
import { reportPeriodSchema } from "../period/period.schema";

const MAX_REPORTING_GROUP_NAME_LENGTH = 200;
const MAX_REPORTING_GROUP_DESCRIPTION_LENGTH = 500;

/** Validates the admin-managed user profile and access assignment. */
export const adminUserSchema = z
  .object({
    id: z.uuid(),
    email: z.email(),
    // Stored display name, denormalized from the parts below on write.
    name: z.string().min(1),
    // Structured ФИО parts (surname-first). last/first required, patronymic
    // optional. The admin form recomputes `name` from these on save.
    lastName: z.string().min(1),
    firstName: z.string().min(1),
    middleName: z.string().nullable(),
    // Admin-maintained HR job title (должность), independent of `role`.
    position: z.string().nullable(),
    role: roleSchema,
    reportingGroupId: z.uuid().nullable().optional(),
    reportingGroupName: z
      .string()
      .min(1)
      .max(MAX_REPORTING_GROUP_NAME_LENGTH)
      .nullable()
      .optional(),
    // Snapshot rows without an explicit lifecycle flag remain active.
    isActive: z.boolean().default(true),
  })
  .readonly();

/** Validates one reporting group and its optional leader. */
export const reportingGroupSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1).max(MAX_REPORTING_GROUP_NAME_LENGTH),
    description: z
      .string()
      .max(MAX_REPORTING_GROUP_DESCRIPTION_LENGTH)
      .nullable()
      .optional(),
    archived: z.boolean(),
    // Optional FK to the User (role=head or admin) that runs this group.
    // null when the admin has not yet assigned a leader.
    headUserId: z.uuid().nullable().optional(),
  })
  .readonly();

/** Validates the compact product row shown in admin management. */
export const adminProjectSchema = z
  .object({
    id: z.uuid(),
    name: z.string().min(1),
    archived: z.boolean(),
    leadId: z.uuid(),
    leadName: z.string().min(1),
  })
  .readonly();

/**
 * Persisted group-product edge whose business key is the group and product pair.
 */
export const groupProductSchema = z
  .object({
    id: z.uuid(),
    groupId: z.uuid(),
    productId: z.uuid(),
    createdAt: z.coerce.date(),
  })
  .readonly();

/**
 * Input for `admin.attachProductToGroup` and
 * `admin.detachProductFromGroup`. Symmetric because the same tuple
 * identifies the edge on both sides of the M:M relation.
 */
export const groupProductEdgeInputSchema = z
  .object({
    groupId: z.uuid(),
    productId: z.uuid(),
  })
  .readonly();

// 'escalation' fires the T+2h heads-only digest. Bypasses
// User.notificationOptOut — heads must always be notified.
/** Reminder rule categories stored by the admin scheduler. */
export const adminReminderRuleKindSchema = z.enum([
  "deadline",
  "follow_up",
  "escalation",
]);
/** Administrative lifecycle of a generated reminder rule. */
export const adminReminderRuleStatusSchema = z.enum(["active", "paused"]);

/** Validates one generated reminder rule and its optional owning policy. */
export const adminReminderRuleSchema = z
  .object({
    id: z.uuid(),
    reportId: z.uuid().nullable(),
    // Null means the rule is not owned by a reminder policy.
    policyId: z.uuid().nullable().default(null),
    kind: adminReminderRuleKindSchema,
    fireAt: z.coerce.date(),
    timezone: z.string().min(1),
    status: adminReminderRuleStatusSchema,
    version: z.number().int().min(1),
  })
  .readonly();

/** Delivery lifecycle recorded for one reminder execution. */
export const adminReminderExecutionStatusSchema = z.enum([
  "queued",
  "sending",
  "sent",
  "failed",
]);

/** Validates one scheduled reminder delivery attempt. */
export const adminReminderExecutionSchema = z
  .object({
    id: z.uuid(),
    ruleId: z.uuid(),
    reportId: z.uuid().nullable(),
    dedupeKey: z.string().min(1),
    status: adminReminderExecutionStatusSchema,
    scheduledFor: z.coerce.date(),
    sentAt: z.coerce.date().nullable(),
    recipientEmail: z.string(),
    errorMessage: z.string().nullable(),
  })
  .readonly();

/** Validates the complete admin configuration snapshot. */
export const adminSnapshotSchema = z
  .object({
    users: z.array(adminUserSchema).readonly(),
    groups: z.array(reportingGroupSchema).readonly().default([]),
    projects: z.array(adminProjectSchema).readonly(),
    periods: z.array(reportPeriodSchema).readonly(),
    reminderRules: z.array(adminReminderRuleSchema).readonly(),
    reminderExecutions: z
      .array(adminReminderExecutionSchema)
      .readonly()
      .default([]),
    policies: z.array(reminderPolicySchema.readonly()).readonly().default([]),
  })
  .readonly();

/** Metadata for one failed queue job; processor payloads stay server-private. */
export const failedJobSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    failedReason: z.string().min(1),
    stacktrace: z.array(z.string()).readonly(),
    attemptsMade: z.number().int().min(0),
    timestamp: z.number().int().min(0),
  })
  .readonly();

/** Validates one cursor page of failed queue jobs. */
export const failedJobListSchema = z
  .object({
    jobs: z.array(failedJobSchema).readonly(),
    nextCursor: z.number().int().min(0).nullable(),
  })
  .readonly();

/** Queue names exposed through the admin failed-job surface. */
export const queueNameSchema = z.enum(["email-reminder"]);

/** Admin-editable identity, role, group assignment, and activation state. */
export type AdminUser = z.infer<typeof adminUserSchema>;
/** Reporting group identity with optional lead ownership. */
export type ReportingGroup = z.infer<typeof reportingGroupSchema>;
/** Product identity and archive state shown by admin management. */
export type AdminProject = z.infer<typeof adminProjectSchema>;
/** Persisted relationship between one reporting group and one product. */
export type GroupProduct = z.infer<typeof groupProductSchema>;
/** Command that adds or removes one group-product relationship. */
export type GroupProductEdgeInput = z.infer<typeof groupProductEdgeInputSchema>;
/** Scheduler rule with lifecycle state and optional owning policy. */
export type AdminReminderRule = z.infer<typeof adminReminderRuleSchema>;
/** One reminder delivery attempt and its observable outcome. */
export type AdminReminderExecution = z.infer<
  typeof adminReminderExecutionSchema
>;
/** Immutable export of users, groups, products, periods, reminders, and policies. */
export type AdminSnapshot = z.infer<typeof adminSnapshotSchema>;
/** Failure metadata exposed without server-private processor payloads. */
export type FailedJob = z.infer<typeof failedJobSchema>;
/** Offset page of failed jobs with a nullable continuation cursor. */
export type FailedJobList = z.infer<typeof failedJobListSchema>;
/** Queue name admitted by the admin failed-job surface. */
export type QueueName = z.infer<typeof queueNameSchema>;
