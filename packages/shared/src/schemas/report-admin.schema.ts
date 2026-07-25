import { z } from "zod";

import { reminderPolicySchema } from "../admin/reminder-policy.schema";
import { roleSchema } from "./auth";
import { reportPeriodSchema } from "./period.schema";

const MAX_REPORTING_GROUP_NAME_LENGTH = 200;
const MAX_REPORTING_GROUP_DESCRIPTION_LENGTH = 500;

export const adminUserSchema = z.object({
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
  // Soft-deactivation flag. Defaults to true so existing snapshot rows
  // (created before this field existed) parse cleanly.
  isActive: z.boolean().default(true),
});

export const reportingGroupSchema = z.object({
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
});

export const adminProjectSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  archived: z.boolean(),
  leadId: z.uuid(),
  leadName: z.string().min(1),
});

/**
 * Explicit Group <-> Product M:M edge row. Returned
 * by `admin.attachProductToGroup` and consumed by the admin UI list/chip
 * surfaces. The id is server-assigned; the unique business key is the
 * (groupId, productId) tuple.
 */
export const groupProductSchema = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  productId: z.uuid(),
  createdAt: z.coerce.date(),
});

/**
 * Input for `admin.attachProductToGroup` and
 * `admin.detachProductFromGroup`. Symmetric because the same tuple
 * identifies the edge on both sides of the M:M relation.
 */
export const groupProductEdgeInputSchema = z.object({
  groupId: z.uuid(),
  productId: z.uuid(),
});

// 'escalation' fires the T+2h heads-only digest. Bypasses
// User.notificationOptOut — heads must always be notified.
export const adminReminderRuleKindSchema = z.enum([
  "deadline",
  "follow_up",
  "escalation",
]);
export const adminReminderRuleStatusSchema = z.enum(["active", "paused"]);

export const adminReminderRuleSchema = z.object({
  id: z.uuid(),
  reportId: z.uuid().nullable(),
  /**
   * The FK back to {@link reminderPolicySchema}.
   * Optional on input + transform to `null` so existing fixtures that
   * don't carry the field still validate. The output type is always
   * `string | null` so consumers can group rules under their owning
   * policy in the "Active rules per period" read-only expander without
   * having to handle `undefined`.
   */
  policyId: z.uuid().nullable().default(null),
  kind: adminReminderRuleKindSchema,
  fireAt: z.coerce.date(),
  timezone: z.string().min(1),
  status: adminReminderRuleStatusSchema,
  version: z.number().int().min(1),
});

export const adminReminderExecutionStatusSchema = z.enum([
  "queued",
  "sending",
  "sent",
  "failed",
]);

export const adminReminderExecutionSchema = z.object({
  id: z.uuid(),
  ruleId: z.uuid(),
  reportId: z.uuid().nullable(),
  dedupeKey: z.string().min(1),
  status: adminReminderExecutionStatusSchema,
  scheduledFor: z.coerce.date(),
  sentAt: z.coerce.date().nullable(),
  recipientEmail: z.string(),
  errorMessage: z.string().nullable(),
});

export const adminSnapshotSchema = z.object({
  users: z.array(adminUserSchema),
  groups: z.array(reportingGroupSchema).default([]),
  projects: z.array(adminProjectSchema),
  periods: z.array(reportPeriodSchema),
  reminderRules: z.array(adminReminderRuleSchema),
  reminderExecutions: z.array(adminReminderExecutionSchema).default([]),
  /**
   * List of {@link reminderPolicySchema} rows.
   * `default([])` keeps every existing fixture / parser call site
   * compatible — older snapshots (and the in-memory test repos) emit
   * snapshots without this field, and the schema fills the array.
   */
  policies: z.array(reminderPolicySchema).default([]),
});

// ---------------------------------------------------------------------------
// BullMQ DLQ admin surface (admin.jobs.listFailed / retryFailed)
// ---------------------------------------------------------------------------

/**
 * Read model for one entry in the BullMQ failed-set surfaced to admins.
 *
 * `id` is BullMQ's job id (an opaque numeric string), `name` is the
 * processor name (e.g. 'send-reminder-email'), and `data` is the job's
 * original payload. We keep `data` as `unknown` because the queue carries
 * different shapes across processors and the admin UI only renders metadata.
 */
export const failedJobSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  failedReason: z.string(),
  stacktrace: z.array(z.string()),
  attemptsMade: z.number().int().min(0),
  timestamp: z.number().int().min(0),
  data: z.unknown(),
});

export const failedJobListSchema = z.object({
  jobs: z.array(failedJobSchema),
  nextCursor: z.number().int().min(0).nullable(),
});

export const queueNameSchema = z.enum(["email-reminder"]);

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type AdminUser = z.infer<typeof adminUserSchema>;
export type ReportingGroup = z.infer<typeof reportingGroupSchema>;
export type AdminProject = z.infer<typeof adminProjectSchema>;
export type GroupProduct = z.infer<typeof groupProductSchema>;
export type GroupProductEdgeInput = z.infer<typeof groupProductEdgeInputSchema>;
export type AdminReminderRule = z.infer<typeof adminReminderRuleSchema>;
export type AdminReminderExecution = z.infer<
  typeof adminReminderExecutionSchema
>;
export type AdminSnapshot = z.infer<typeof adminSnapshotSchema>;
export type FailedJob = z.infer<typeof failedJobSchema>;
export type FailedJobList = z.infer<typeof failedJobListSchema>;
export type QueueName = z.infer<typeof queueNameSchema>;
