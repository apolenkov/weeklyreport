import { z } from "zod";

import { reminderPolicySchema } from "../admin/reminder-policy.schema";
import { roleSchema } from "./auth";
import { reportPeriodSchema } from "./period.schema";
import {
  type periodStateSchema,
  periodStatusSchema,
  reportDate,
  reportSectionStatusSchema,
  reportStatusSchema,
  trafficLightStatusSchema,
} from "./report-primitives.schema";
import { reportSectionReadModelSchema } from "./section.schema";

const MAX_REPORTING_GROUP_NAME_LENGTH = 200;
const MAX_REPORTING_GROUP_DESCRIPTION_LENGTH = 500;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/**
 * Row shape for the head/admin "Активность за текущий период" panel. One
 * row per lead's section in the open report period;
 * `lastEditAt` is the most-recent updatedAt across the section's rows
 * (items + risks + decisions). Polled every 15s on the
 * dashboard.
 */
export const activityLiveRowSchema = z.object({
  reportId: z.uuid(),
  reportSectionId: z.uuid().nullable(),
  leadId: z.uuid(),
  leadName: z.string().min(1),
  email: z.email(),
  status: reportSectionStatusSchema,
  itemCount: z.number().int().min(0),
  riskCount: z.number().int().min(0),
  decisionCount: z.number().int().min(0),
  priorityCount: z.number().int().min(0),
  lastEditAt: z.coerce.date().nullable(),
  submittedAt: z.coerce.date().nullable(),
});

export type ActivityLiveRow = z.infer<typeof activityLiveRowSchema>;

export const activityLiveResponseSchema = z.object({
  reportId: z.uuid().nullable(),
  periodStart: reportDate().nullable(),
  periodEnd: reportDate().nullable(),
  periodStatus: periodStatusSchema.nullable(),
  rows: z.array(activityLiveRowSchema),
});

export type ActivityLiveResponse = z.infer<typeof activityLiveResponseSchema>;

export const portfolioOverviewSchema = z.object({
  status: trafficLightStatusSchema,
  totals: z.object({
    green: z.number().int().min(0),
    yellow: z.number().int().min(0),
    red: z.number().int().min(0),
  }),
});

export const assembledReportSchema = z.object({
  reportId: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
  status: reportStatusSchema,
  publishedAt: z.coerce.date().nullable().default(null),
  publishedById: z.uuid().nullable().default(null),
  publishedByName: z.string().min(1).nullable().default(null),
  portfolioOverview: portfolioOverviewSchema,
  sections: z.array(reportSectionReadModelSchema),
});

export const pdfExportStatusSchema = z.enum(["queued", "completed", "failed"]);

export const pdfExportRequestSchema = z.object({
  reportId: z.uuid(),
});

export const pdfExportJobSchema = z.object({
  jobId: z.uuid(),
  reportId: z.uuid(),
  status: pdfExportStatusSchema,
  requestedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  checksum: z.string().nullable(),
  templateVersion: z.string().min(1),
  artifactUrl: z.string().min(1).nullable(),
});

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

export const carryOverStatusSchema = z.enum(["completed"]);

export const carryOverRecordSchema = z.object({
  id: z.uuid(),
  sourceReportId: z.uuid(),
  targetReportId: z.uuid(),
  sourceItemId: z.uuid().nullable(),
  targetItemId: z.uuid().nullable(),
  sourceDecisionId: z.uuid().nullable(),
  targetDecisionId: z.uuid().nullable(),
  status: carryOverStatusSchema,
  carriedAt: z.coerce.date(),
});

export const carryOverExecutionSchema = z.object({
  id: z.uuid(),
  sourceReportId: z.uuid(),
  targetReportId: z.uuid(),
  dedupeKey: z.string().min(1),
  status: carryOverStatusSchema,
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date(),
  carriedItemCount: z.number().int().min(0),
  carriedDecisionCount: z.number().int().min(0),
});

export const archiveReportSummarySchema = z.object({
  reportId: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  publishedAt: reportDate(),
  publishedByName: z.string().min(1),
  portfolioStatus: trafficLightStatusSchema,
});

export const archiveReportDetailSchema = z.object({
  summary: archiveReportSummarySchema,
  report: assembledReportSchema,
});

export const compiledHistoryInputSchema = z.object({
  includeArchive: z.boolean().optional(),
});

export const compiledHistoryEntrySchema = z.object({
  reportId: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  publishedAt: z.coerce.date().nullable(),
  archived: z.boolean(),
  publishedByName: z.string().min(1),
  trafficLights: z.object({
    green: z.number().int().min(0),
    yellow: z.number().int().min(0),
    red: z.number().int().min(0),
  }),
  itemCount: z.number().int().min(0),
  riskCount: z.number().int().min(0),
  decisionCount: z.number().int().min(0),
  priorityCount: z.number().int().min(0),
  sectionCount: z.number().int().min(0),
  productCount: z.number().int().min(0),
});

export const compiledHistoryResultSchema = z.object({
  entries: z.array(compiledHistoryEntrySchema),
  archiveCount: z.number().int().min(0),
});

/**
 * viewer-live-status: result of the Status-target resolver behind
 * `/reports/latest`. `reportId` is the **Status target** — the current editable
 * period (when it has a viewer-visible section), else the newest viewer-visible
 * `published` report, else `null` (empty state).
 */
export const latestForViewerReportSchema = z.object({
  reportId: z.uuid().nullable(),
});
export type LatestForViewerReport = z.infer<typeof latestForViewerReportSchema>;

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

export type FailedJob = z.infer<typeof failedJobSchema>;
export type FailedJobList = z.infer<typeof failedJobListSchema>;
export type QueueName = z.infer<typeof queueNameSchema>;

// ---------------------------------------------------------------------------
// Weekly report read model
// ---------------------------------------------------------------------------

export const portfolioProductOverviewSchema = z.object({
  productId: z.uuid(),
  productName: z.string().min(1),
  worstStatus: trafficLightStatusSchema.nullable(),
  stageCount: z.number().int().min(0),
  leadNames: z.array(z.string().min(1)),
});

export const escalationSchema = z.object({
  type: z.enum(["blocked", "at_risk", "unresolved_risk"]),
  productName: z.string().min(1),
  stageName: z.string().nullable(),
  leadName: z.string().min(1),
  description: z.string(),
});

export const weeklyReportReadModelSchema = z.object({
  reportId: z.uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
  periodStatus: periodStatusSchema,
  weekLabel: z.string().nullable(),
  // `departmentName` is NOT on the weekly read model. Frontends pull the
  // brand label from `auth.me.organization` hydrated on every authenticated
  // request (one source of truth).
  submissionCount: z.number().int().min(0),
  totalLeads: z.number().int().min(0),
  hasActiveReminderRule: z.boolean().default(false),
  portfolioOverview: z.array(portfolioProductOverviewSchema),
  leadSections: z.array(reportSectionReadModelSchema),
  escalations: z.array(escalationSchema),
});

/**
 * Discriminated-union response for `weeklyReport.get`.
 *
 * When no active Period exists the procedure returns `{ status: 'no-period',
 * report: null }` instead of throwing NOT_FOUND. This eliminates the React
 * Query retry storm (3 × retry = 3–5 s spinner) on fresh installs and
 * between period cycles.
 *
 * Consumers guard with `if (data.status === 'no-period') return <EmptyState/>`.
 */
export const weeklyReportGetResponseSchema = z.discriminatedUnion("status", [
  weeklyReportReadModelSchema.extend({ status: z.literal("active") }),
  z.object({ status: z.literal("no-period"), report: z.null() }),
]);

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type PeriodStatus = z.infer<typeof periodStatusSchema>;
export type PeriodState = z.infer<typeof periodStateSchema>;
export type PortfolioProductOverview = z.infer<
  typeof portfolioProductOverviewSchema
>;
export type Escalation = z.infer<typeof escalationSchema>;
export type WeeklyReportReadModel = z.infer<typeof weeklyReportReadModelSchema>;
export type WeeklyReportGetResponse = z.infer<
  typeof weeklyReportGetResponseSchema
>;

export type PortfolioOverview = z.infer<typeof portfolioOverviewSchema>;
export type AssembledReport = z.infer<typeof assembledReportSchema>;
export type PdfExportRequest = z.infer<typeof pdfExportRequestSchema>;
export type PdfExportJob = z.infer<typeof pdfExportJobSchema>;
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
export type CarryOverRecord = z.infer<typeof carryOverRecordSchema>;
export type CarryOverExecution = z.infer<typeof carryOverExecutionSchema>;
export type ArchiveReportSummary = z.infer<typeof archiveReportSummarySchema>;
export type ArchiveReportDetail = z.infer<typeof archiveReportDetailSchema>;
export type CompiledHistoryInput = z.infer<typeof compiledHistoryInputSchema>;
export type CompiledHistoryEntry = z.infer<typeof compiledHistoryEntrySchema>;
export type CompiledHistoryResult = z.infer<typeof compiledHistoryResultSchema>;

export const myHistoryEntrySchema = z.object({
  sectionId: z.uuid(),
  reportId: z.uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  reportStatus: reportStatusSchema,
  sectionStatus: reportSectionStatusSchema,
  archived: z.boolean().optional(),
  submittedAt: z.coerce.date().nullable(),
  publishedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  lastEditAt: z.coerce.date().nullable().optional(),
  itemCount: z.number().int().min(0).optional(),
  riskCount: z.number().int().min(0).optional(),
  decisionCount: z.number().int().min(0).optional(),
  priorityCount: z.number().int().min(0).optional(),
  productCount: z.number().int().min(0).optional(),
  trafficLights: z
    .object({
      green: z.number().int().min(0),
      yellow: z.number().int().min(0),
      red: z.number().int().min(0),
    })
    .optional(),
});

export type MyHistoryEntry = z.infer<typeof myHistoryEntrySchema>;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const paginationInputSchema = z.object({
  // Opaque pagination token: a row id for the log / reminder lists, an encoded
  // keyset coordinate for the archive. Validated only as a non-empty string so
  // no single consumer's cursor shape is baked into the shared contract.
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PaginationInput = z.infer<typeof paginationInputSchema>;

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}
