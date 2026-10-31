import { z } from "zod";

import { reminderPolicySchema } from "../../admin/reminder-policy.schema.js";
import { roleSchema } from "../auth/auth.js";
import {
  MAX_WEEK_LABEL_LENGTH,
  reportPeriodSchema,
} from "../period/period.schema.js";
import {
  isPeriodInverted,
  safeText,
} from "../primitives/report-primitives.schema.js";
import {
  pdfExportStatusSchema,
  publishedReportSnapshotSchema,
} from "../report/report.schema.js";
import { validateAdminSnapshotIntegrity } from "./admin-snapshot-integrity.js";
import {
  adminSnapshotReminderExecutionSchema,
  adminSnapshotReminderRuleSchema,
} from "./reminder-recovery.schema.js";

export { normalizeEmail } from "./admin-snapshot-integrity.js";
export type {
  AdminReminderExecution,
  AdminReminderRule,
  ReminderQueuePayload,
} from "./reminder-recovery.schema.js";
export {
  adminReminderExecutionSchema,
  adminReminderRuleSchema,
  adminSnapshotReminderExecutionSchema,
  adminSnapshotReminderRuleSchema,
  reminderDeadlinePayloadSchema,
  reminderEscalationPayloadSchema,
  reminderQueuePayloadSchema,
} from "./reminder-recovery.schema.js";

const MAX_REPORTING_GROUP_NAME_LENGTH = 200;
const MAX_REPORTING_GROUP_DESCRIPTION_LENGTH = 500;

/**
 * Shared admin-user fields. Free-text fields are declared by each schema
 * below: the read contract keeps stored values as-is, the write contract
 * applies the safe-text rule.
 */
const adminUserNonTextShape = {
  id: z.uuid(),
  email: z.email(),
  role: roleSchema,
  reportingGroupId: z.uuid().nullable().optional(),
  reportingGroupName: z
    .string()
    .min(1)
    .max(MAX_REPORTING_GROUP_NAME_LENGTH)
    .nullable()
    .optional(),
  // Restore must preserve the durable lifecycle flag carried by the snapshot.
  isActive: z.boolean(),
};

/** Validates the admin-managed user profile and access assignment (read contract). */
export const adminUserSchema = z
  .object({
    ...adminUserNonTextShape,
    // Stored display name, denormalized from the parts below on write.
    name: z.string().min(1),
    // Structured ФИО parts (surname-first). last/first required, patronymic
    // optional. The admin form recomputes `name` from these on save.
    lastName: z.string().min(1),
    firstName: z.string().min(1),
    middleName: z.string().nullable(),
    // Admin-maintained HR job title (должность), independent of `role`.
    position: z.string().nullable(),
  })
  .readonly();

/**
 * Input for `admin.users.saveUser`: the same user shape, with every free-text
 * field validated by the shared safe-text primitive (rejects null bytes and
 * values made only of whitespace or invisible characters). Stored values are
 * read through `adminUserSchema` and are not re-validated here.
 */
export const adminUserInputSchema = z
  .object({
    ...adminUserNonTextShape,
    name: safeText(),
    lastName: safeText(),
    firstName: safeText(),
    middleName: safeText().nullable(),
    position: safeText().nullable(),
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

/**
 * Admin restore period row, including the immutable document for published
 * lifecycles. This deliberately stays separate from the UI's ReportPeriod:
 * admin recovery must carry publication data, while editable period surfaces
 * must not accidentally depend on it.
 */
const adminReportPeriodLifecycleSnapshotSchema = z.object({
  publishedSnapshot: publishedReportSnapshotSchema,
});
const adminReportPeriodRecoveryFieldsSchema = z.object({
  weekLabel: z.string().max(MAX_WEEK_LABEL_LENGTH).nullable(),
});

const adminReportPeriodDraftSchema = reportPeriodSchema
  .and(
    adminReportPeriodRecoveryFieldsSchema.extend({
      status: z.literal("draft"),
      publishedSnapshot: z.null(),
    }),
  )
  .readonly();

const adminReportPeriodPublishedSchema = reportPeriodSchema
  .and(
    adminReportPeriodLifecycleSnapshotSchema
      .extend(adminReportPeriodRecoveryFieldsSchema.shape)
      .extend({ status: z.literal("published") }),
  )
  .superRefine((period, context) => {
    const { id, publishedSnapshot } = period;
    const addSnapshotIssue = (path: string, message: string): void => {
      context.addIssue({
        code: "custom",
        path: ["publishedSnapshot", path],
        message,
      });
    };
    const sameDate = (left: Date | null, right: Date | null): boolean =>
      left?.getTime() === right?.getTime();

    const identityIssues: readonly [string, boolean, string][] = [
      [
        "reportId",
        publishedSnapshot.reportId !== id,
        "Published snapshot must belong to the restored report.",
      ],
      [
        "publishedAt",
        !sameDate(publishedSnapshot.publishedAt, period.publishedAt),
        "Published snapshot timestamp must match the restored report.",
      ],
      [
        "publishedById",
        publishedSnapshot.publishedById !== period.publishedById,
        "Published snapshot publisher must match the restored report.",
      ],
    ];
    for (const [path, invalid, message] of identityIssues) {
      if (invalid) addSnapshotIssue(path, message);
    }

    // A reopened report may have a newly edited envelope while retaining its
    // prior immutable publication. Closed publications must match exactly.
    if (period.periodStatus === "published") {
      const closedEnvelopeIssues: readonly [string, boolean, string][] = [
        [
          "periodStart",
          !sameDate(publishedSnapshot.periodStart, period.periodStart),
          "Published snapshot start must match the closed report.",
        ],
        [
          "periodEnd",
          !sameDate(publishedSnapshot.periodEnd, period.periodEnd),
          "Published snapshot end must match the closed report.",
        ],
        [
          "deadline",
          !sameDate(publishedSnapshot.deadline, period.deadline),
          "Published snapshot deadline must match the closed report.",
        ],
      ];
      for (const [path, invalid, message] of closedEnvelopeIssues) {
        if (invalid) addSnapshotIssue(path, message);
      }
    }
  })
  .readonly();

/** Validates the lifecycle and immutable publication payload used by recovery. */
export const adminReportPeriodSchema = z.union([
  adminReportPeriodDraftSchema,
  adminReportPeriodPublishedSchema,
]);

/** Validates the complete admin configuration snapshot. */
export const adminSnapshotSchema = z
  .object({
    users: z.array(adminUserSchema).readonly(),
    groups: z.array(reportingGroupSchema).readonly(),
    projects: z.array(adminProjectSchema).readonly(),
    periods: z.array(adminReportPeriodSchema).readonly(),
    reminderRules: z.array(adminSnapshotReminderRuleSchema).readonly(),
    reminderExecutions: z
      .array(adminSnapshotReminderExecutionSchema)
      .readonly(),
    policies: z.array(reminderPolicySchema.readonly()).readonly(),
  })
  .superRefine(validateAdminSnapshotIntegrity)
  .readonly();

const PERIOD_ORDER_MESSAGE = "Period end must not be before period start.";

// Restore is the only writer that reaches published rows without
// assertEndNotBeforeStart or the live tsrange exclusion. The check lives on the
// restore input, not on the shared read schemas, so stored data stays readable.
function addSnapshotPeriodOrderIssues(
  snapshot: z.infer<typeof adminSnapshotSchema>,
  context: z.RefinementCtx,
): void {
  snapshot.periods.forEach((period, index) => {
    if (isPeriodInverted(period))
      context.addIssue({
        code: "custom",
        path: ["periods", index, "periodEnd"],
        message: PERIOD_ORDER_MESSAGE,
      });
    if (period.publishedSnapshot && isPeriodInverted(period.publishedSnapshot))
      context.addIssue({
        code: "custom",
        path: ["periods", index, "publishedSnapshot", "periodEnd"],
        message: PERIOD_ORDER_MESSAGE,
      });
  });
}

/** Validates a snapshot about to be restored: the admin snapshot plus ordered period envelopes. */
export const adminSnapshotRestoreSchema = adminSnapshotSchema.superRefine(
  addSnapshotPeriodOrderIssues,
);

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

/**
 * Validates one cursor page of failed queue jobs.
 * @public
 */
export const failedJobListSchema = z
  .object({
    jobs: z.array(failedJobSchema).readonly(),
    nextCursor: z.number().int().min(0).nullable(),
  })
  .readonly();

/**
 * One durable PDF export row listed for head-driven recovery: rows quarantined
 * as `recovery_required` and terminally `failed` rows alike. The generation's
 * queue job may already be gone, so the DB-backed surface never consults
 * Redis.
 */
export const pdfRecoveryJobSchema = z
  .object({
    jobId: z.uuid(),
    reportId: z.uuid(),
    generation: z.number().int().min(1),
    requestedBy: z.uuid(),
    status: pdfExportStatusSchema.extract(["failed", "recovery_required"]),
    createdAt: z.coerce.date(),
  })
  .readonly();

/** Last listed row of a recovery page; the next page starts strictly after it. */
export const pdfRecoveryCursorSchema = z
  .object({
    createdAt: z.coerce.date(),
    jobId: z.uuid(),
  })
  .readonly();

/** Validates one DB-backed page of exports awaiting recovery. */
export const pdfRecoveryJobListSchema = z
  .object({
    jobs: z.array(pdfRecoveryJobSchema).readonly(),
    nextCursor: pdfRecoveryCursorSchema.nullable(),
  })
  .readonly();

/**
 * Input for `admin.jobs.retryPdfRecovery`. `expectedGeneration` binds the retry
 * to the generation the caller selected; the durable row decides eligibility.
 */
export const pdfRecoveryRetryInputSchema = z
  .object({
    jobId: z.uuid(),
    expectedGeneration: z.number().int().min(1),
  })
  .readonly();

/**
 * Outcome of a head-driven recovery retry: the generation advanced, the same
 * request already advanced it (idempotent no-op), or the row was ineligible.
 */
export const pdfRecoveryRetryOutcomeSchema = z.enum([
  "retried",
  "already-advanced",
  "ineligible",
]);

/** Result of `admin.jobs.retryPdfRecovery`. */
export const pdfRecoveryRetryResultSchema = z
  .object({
    jobId: z.uuid(),
    outcome: pdfRecoveryRetryOutcomeSchema,
  })
  .readonly();

/** Canonical BullMQ queue name for reminder delivery jobs. */
export const EMAIL_REMINDER_QUEUE_NAME = "email-reminder" as const;
/** Canonical BullMQ queue name for PDF export jobs. */
export const PDF_EXPORT_QUEUE_NAME = "pdf-export" as const;
/** Canonical BullMQ queue name for AI provider test jobs. */
export const AI_PROVIDER_TEST_QUEUE_NAME = "ai-provider-test" as const;
/** Canonical BullMQ queue name for semantic indexing jobs. */
export const SEMANTIC_INDEX_QUEUE_NAME = "semantic-index" as const;
/** Stable queue order shared by monitoring, admin APIs, and UI selectors. */
export const QUEUE_NAMES = [
  EMAIL_REMINDER_QUEUE_NAME,
  PDF_EXPORT_QUEUE_NAME,
  AI_PROVIDER_TEST_QUEUE_NAME,
  SEMANTIC_INDEX_QUEUE_NAME,
] as const;
/** Queue names exposed through the admin failed-job surface. */
export const queueNameSchema = z.enum(QUEUE_NAMES);
/** Queue name accepted by the admin failed-job surface. */
export type QueueName = z.infer<typeof queueNameSchema>;

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
/** Lifecycle-complete period row used by admin snapshot export and restore. */
export type AdminReportPeriod = z.infer<typeof adminReportPeriodSchema>;
/** Immutable export of users, groups, products, periods, reminders, and policies. */
export type AdminSnapshot = z.infer<typeof adminSnapshotSchema>;
/** Failure metadata exposed without server-private processor payloads. */
export type FailedJob = z.infer<typeof failedJobSchema>;
/** Offset page of failed jobs with a nullable continuation cursor. */
export type FailedJobList = z.infer<typeof failedJobListSchema>;
/** Durable export row listed for head-driven recovery. */
export type PdfRecoveryJob = z.infer<typeof pdfRecoveryJobSchema>;
/** Last listed recovery row; the next page starts strictly after it. */
export type PdfRecoveryCursor = z.infer<typeof pdfRecoveryCursorSchema>;
/** One DB-backed page of exports awaiting recovery. */
export type PdfRecoveryJobList = z.infer<typeof pdfRecoveryJobListSchema>;
/** Generation-bound retry input for the recovery surface. */
export type PdfRecoveryRetryInput = z.infer<typeof pdfRecoveryRetryInputSchema>;
/** Recovery retry outcome: advanced, idempotent no-op, or ineligible. */
export type PdfRecoveryRetryOutcome = z.infer<
  typeof pdfRecoveryRetryOutcomeSchema
>;
/** Recovery retry result carrying the outcome classification. */
export type PdfRecoveryRetryResult = z.infer<
  typeof pdfRecoveryRetryResultSchema
>;
