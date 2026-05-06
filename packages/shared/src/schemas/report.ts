import { z } from 'zod';

import { roleSchema } from './auth';

/** Rejects strings that contain only whitespace or zero-width characters */
const noInvisibleOnly = (val: string) =>
  val.replace(/[\s\u200B\u200C\u200D\uFEFF]/g, '').length > 0;

/** Rejects strings containing null bytes (PostgreSQL incompatible) */
const noNullBytes = (val: string) => !val.includes('\u0000');

/**
 * Safe text schema: rejects null bytes and zero-width-space-only strings.
 * Use in place of z.string().min(N).max(M) for all user-facing text fields.
 */
const safeText = (opts: { min?: number; max?: number } = {}) =>
  z.string()
    .min(opts.min ?? 1)
    .max(opts.max ?? 500)
    .refine(noNullBytes, { message: 'Text must not contain null bytes' })
    .refine(noInvisibleOnly, { message: 'Text must contain visible characters' });

/** Rejects dates before year 2000 (prevents pre-epoch/nonsensical report dates) */
const reportDate = () =>
  z.coerce.date().refine(
    (d) => d.getFullYear() >= 2000,
    { message: 'Date must be after year 2000' },
  );

export const trafficLightStatusSchema = z.enum(['green', 'yellow', 'red']);
export const itemTypeSchema = z.enum(['current', 'next']);
export const itemWorkflowStatusSchema = z.enum(['done', 'in_progress', 'blocked']);
export const reportSectionStatusSchema = z.enum(['draft', 'submitted']);
export const reportStatusSchema = z.enum(['draft', 'published']);
export const periodStatusSchema = z.enum(['open', 'published', 'reopened']);

export const projectStatusInputSchema = z.object({
  projectId: z.string().uuid(),
  status: trafficLightStatusSchema.optional(),
});

// 35-04: optional SDLC stage label carried per entry. The DB column stays
// nullable so the column migration is non-destructive for legacy rows
// seeded before this field existed; the lead-form modals enforce the
// non-empty constraint client-side once a stage is selectable.
const stageNameField = z.string().min(1).max(50).nullable().optional();

export const itemInputSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  type: itemTypeSchema,
  text: safeText({ max: 500 }),
  tag: safeText({ max: 50 }),
  workflowStatus: itemWorkflowStatusSchema,
  carriedOver: z.boolean().default(false),
  completed: z.boolean().nullable().optional(),
  stageName: stageNameField,
});

export const riskInputSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  risk: safeText({ max: 500 }),
  impact: safeText({ max: 500 }),
  mitigation: safeText({ max: 500 }),
  stageName: stageNameField,
});

export const decisionInputSchema = z.object({
  id: z.string().uuid().optional(),
  text: safeText({ max: 500 }),
  owner: safeText({ max: 200 }),
  deadline: z.coerce.date().nullable().optional(),
  impact: safeText({ max: 500 }),
  resolvedAt: z.coerce.date().nullable().optional(),
  stageName: stageNameField,
});

export const priorityInputSchema = z.object({
  id: z.string().uuid().optional(),
  rank: z.number().int().min(1),
  text: safeText({ max: 200 }),
  stageName: stageNameField,
});

export const draftSaveSchema = z.object({
  reportSectionId: z.string().uuid(),
  status: reportSectionStatusSchema.default('draft'),
  projectStatuses: z.array(projectStatusInputSchema),
  items: z.array(itemInputSchema).max(100),
  risks: z.array(riskInputSchema).max(100),
  decisions: z.array(decisionInputSchema).max(100),
  priorities: z.array(priorityInputSchema).max(50),
});

export const submitSectionSchema = draftSaveSchema.extend({
  confirmed: z.literal(true),
  projectStatuses: z.array(projectStatusInputSchema.extend({
    status: trafficLightStatusSchema,
  })).min(1),
  priorities: z.array(priorityInputSchema).min(1).refine(
    (priorities) => {
      const ranks = priorities.map((p) => p.rank);
      return new Set(ranks).size === ranks.length;
    },
    { message: 'Priority ranks must be unique' },
  ),
});

// 35-04: per-project list of stages owned by the section author on this
// project. Sourced from `StageAssignment` rows scoped by (projectId,
// userId=author). Empty array == author has no stake on this project,
// in which case the lead-form renders the project's stages as
// `unassigned` chips with assignee=null.
export const ownedStageSchema = z.object({
  stageId: z.string().uuid(),
  stageName: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

export const projectReadModelSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string().min(1),
  trafficLight: trafficLightStatusSchema.nullable(),
  /**
   * Stages this project's section author owns via `StageAssignment`. The
   * lead-form renders the standard 7-stage grid and marks each stage as
   * "mine" iff its name matches one of these. Optional so existing
   * fixtures and contract-test factories that pre-date 35-04 still
   * type-check; missing -> empty array means "no stake on this project"
   * which the lead-form mapper handles symmetrically.
   */
  ownedStages: z.array(ownedStageSchema).optional(),
});

// 35-03: role label of the section author, surfaced end-to-end so the
// /lead/report chrome can switch between "Request Reopen" (lead-on-own-
// section) and "Revoke" (head/admin viewing someone else's section).
// Optional so legacy fixtures continue to parse — consumers that gate
// on the role default to `'lead'` when missing.
export const reportSectionReadModelSchema = z.object({
  reportSectionId: z.string().uuid(),
  reportId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string().min(1),
  authorRole: roleSchema.optional(),
  status: reportSectionStatusSchema,
  submittedAt: z.coerce.date().nullable(),
  projects: z.array(projectReadModelSchema),
  items: z.array(itemInputSchema),
  risks: z.array(riskInputSchema),
  decisions: z.array(decisionInputSchema),
  priorities: z.array(priorityInputSchema),
});

export const submissionDashboardRowSchema = z.object({
  leadId: z.string().uuid(),
  leadName: z.string().min(1),
  role: roleSchema,
  projectNames: z.array(z.string().min(1)),
  status: reportSectionStatusSchema,
  submittedAt: z.coerce.date().nullable(),
});

/**
 * UX-18 (Phase 35-08): row shape for the head/admin "Активность за текущий
 * период" panel. One row per lead's section in the open report period;
 * `lastEditAt` is the most-recent updatedAt across the section's rows
 * (items + risks + decisions + priorities). Polled every 15s on the
 * dashboard.
 */
export const activityLiveRowSchema = z.object({
  reportId: z.string().uuid(),
  reportSectionId: z.string().uuid().nullable(),
  leadId: z.string().uuid(),
  leadName: z.string().min(1),
  email: z.string().email(),
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
  reportId: z.string().uuid().nullable(),
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
  reportId: z.string().uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
  status: reportStatusSchema,
  publishedAt: z.coerce.date().nullable().default(null),
  publishedById: z.string().uuid().nullable().default(null),
  publishedByName: z.string().min(1).nullable().default(null),
  portfolioOverview: portfolioOverviewSchema,
  sections: z.array(reportSectionReadModelSchema),
});

export const pdfExportStatusSchema = z.enum([
  'queued',
  'processing',
  'completed',
  'failed',
]);

export const pdfExportRequestSchema = z.object({
  reportId: z.string().uuid(),
});

export const pdfExportJobSchema = z.object({
  jobId: z.string().uuid(),
  reportId: z.string().uuid(),
  status: pdfExportStatusSchema,
  requestedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  checksum: z.string().nullable(),
  templateVersion: z.string().min(1),
  artifactUrl: z.string().min(1).nullable(),
});

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.email(),
  name: z.string().min(1),
  role: roleSchema,
});

export const adminProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  archived: z.boolean(),
  leadId: z.string().uuid(),
  leadName: z.string().min(1),
});

export const reportPeriodSchema = z.object({
  id: z.string().uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
  status: reportStatusSchema,
});

// NOTIF-02 (Phase 29-05): 'escalation' added for T+2h heads-only digest.
// Bypasses User.notificationOptOut — heads must always be notified.
export const adminReminderRuleKindSchema = z.enum(['deadline', 'follow_up', 'escalation']);
export const adminReminderRuleStatusSchema = z.enum(['active', 'paused']);

export const adminReminderRuleSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid().nullable(),
  kind: adminReminderRuleKindSchema,
  fireAt: z.coerce.date(),
  timezone: z.string().min(1),
  status: adminReminderRuleStatusSchema,
  version: z.number().int().min(1),
});

export const adminReminderExecutionStatusSchema = z.enum([
  'queued',
  'sent',
  'failed',
]);

export const adminReminderExecutionSchema = z.object({
  id: z.string().uuid(),
  ruleId: z.string().uuid(),
  reportId: z.string().uuid().nullable(),
  dedupeKey: z.string().min(1),
  status: adminReminderExecutionStatusSchema,
  scheduledFor: z.coerce.date(),
  sentAt: z.coerce.date().nullable(),
  recipientEmail: z.string(),
  errorMessage: z.string().nullable(),
});

export const carryOverStatusSchema = z.enum(['pending', 'completed', 'failed']);

export const carryOverRecordSchema = z.object({
  id: z.string().uuid(),
  sourceReportId: z.string().uuid(),
  targetReportId: z.string().uuid(),
  sourceItemId: z.string().uuid().nullable(),
  targetItemId: z.string().uuid().nullable(),
  sourceDecisionId: z.string().uuid().nullable(),
  targetDecisionId: z.string().uuid().nullable(),
  status: carryOverStatusSchema,
  carriedAt: z.coerce.date(),
});

export const carryOverExecutionSchema = z.object({
  id: z.string().uuid(),
  sourceReportId: z.string().uuid(),
  targetReportId: z.string().uuid(),
  dedupeKey: z.string().min(1),
  status: carryOverStatusSchema,
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date(),
  carriedItemCount: z.number().int().min(0),
  carriedDecisionCount: z.number().int().min(0),
});

export const archiveReportSummarySchema = z.object({
  reportId: z.string().uuid(),
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

export const adminSnapshotSchema = z.object({
  users: z.array(adminUserSchema),
  projects: z.array(adminProjectSchema),
  periods: z.array(reportPeriodSchema),
  reminderRules: z.array(adminReminderRuleSchema),
  reminderExecutions: z.array(adminReminderExecutionSchema).default([]),
});

// ---------------------------------------------------------------------------
// v4.0: Stage & Assignment schemas (D-63)
// ---------------------------------------------------------------------------

export const stageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  sortOrder: z.number().int().min(0),
});

export const stageAssignmentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  stageId: z.string().uuid(),
  projectId: z.string().uuid(),
  stageName: z.string().min(1),
  userName: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// v4.0: Version snapshot (D-67)
// ---------------------------------------------------------------------------

export const versionSnapshotSchema = z.object({
  id: z.string().uuid(),
  reportSectionId: z.string().uuid(),
  version: z.number().int().positive(),
  createdAt: z.coerce.date(),
  /**
   * Counts derived from the snapshot's `data` JSON column. Carried in the
   * read model so the version-history UI can render delta summaries
   * (e.g. "+1 item, +2 risks added") without fetching the full snapshot
   * payload for every row. Optional with a 0 default so legacy callers
   * that constructed snapshots without counts (pre-fix) keep parsing.
   */
  itemCount: z.number().int().min(0).default(0),
  riskCount: z.number().int().min(0).default(0),
  decisionCount: z.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// v4.0: App settings (D-68)
// ---------------------------------------------------------------------------

export const appSettingsSchema = z.object({
  departmentName: z.string().min(1).max(200),
  autoCreatePeriods: z.boolean(),
  defaultDeadlineDays: z.number().int().min(1).max(30),
});

export const appSettingsUpdateSchema = appSettingsSchema.partial();

// ---------------------------------------------------------------------------
// v4.0: Period read model (extended)
// ---------------------------------------------------------------------------

export const periodReadModelSchema = z.object({
  id: z.string().uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  deadline: reportDate(),
  status: reportStatusSchema,
  periodStatus: periodStatusSchema,
  weekLabel: z.string().nullable(),
  publishedAt: z.coerce.date().nullable(),
  reopenedAt: z.coerce.date().nullable(),
});

// ---------------------------------------------------------------------------
// v4.0: Weekly report read model (D-58)
// ---------------------------------------------------------------------------

export const portfolioProductOverviewSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1),
  worstStatus: trafficLightStatusSchema.nullable(),
  stageCount: z.number().int().min(0),
  leadNames: z.array(z.string().min(1)),
});

export const escalationSchema = z.object({
  type: z.enum(['blocked', 'at_risk', 'unresolved_risk']),
  productName: z.string().min(1),
  stageName: z.string().nullable(),
  leadName: z.string().min(1),
  description: z.string(),
});

export const weeklyReportReadModelSchema = z.object({
  reportId: z.string().uuid(),
  periodStart: reportDate(),
  periodEnd: reportDate(),
  periodStatus: periodStatusSchema,
  weekLabel: z.string().nullable(),
  submissionCount: z.number().int().min(0),
  totalLeads: z.number().int().min(0),
  portfolioOverview: z.array(portfolioProductOverviewSchema),
  leadSections: z.array(reportSectionReadModelSchema),
  escalations: z.array(escalationSchema),
});

// ---------------------------------------------------------------------------
// v4.0: Type exports
// ---------------------------------------------------------------------------

export type PeriodStatus = z.infer<typeof periodStatusSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type StageAssignment = z.infer<typeof stageAssignmentSchema>;
export type VersionSnapshot = z.infer<typeof versionSnapshotSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
export type PeriodReadModel = z.infer<typeof periodReadModelSchema>;
export type PortfolioProductOverview = z.infer<typeof portfolioProductOverviewSchema>;
export type Escalation = z.infer<typeof escalationSchema>;
export type WeeklyReportReadModel = z.infer<typeof weeklyReportReadModelSchema>;

export type DraftSavePayload = z.input<typeof draftSaveSchema>;
export type DraftSaveInput = z.infer<typeof draftSaveSchema>;
export type SubmitSectionPayload = z.input<typeof submitSectionSchema>;
export type SubmitSectionInput = z.infer<typeof submitSectionSchema>;
export type ReportSectionReadModel = z.infer<typeof reportSectionReadModelSchema>;
export type ProjectReadModel = z.infer<typeof projectReadModelSchema>;
export type OwnedStage = z.infer<typeof ownedStageSchema>;
export type SubmissionDashboardRow = z.infer<typeof submissionDashboardRowSchema>;
export type PortfolioOverview = z.infer<typeof portfolioOverviewSchema>;
export type AssembledReport = z.infer<typeof assembledReportSchema>;
export type PdfExportRequest = z.infer<typeof pdfExportRequestSchema>;
export type PdfExportJob = z.infer<typeof pdfExportJobSchema>;
export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminProject = z.infer<typeof adminProjectSchema>;
export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
export type AdminReminderRule = z.infer<typeof adminReminderRuleSchema>;
export type AdminReminderExecution = z.infer<typeof adminReminderExecutionSchema>;
export type AdminSnapshot = z.infer<typeof adminSnapshotSchema>;
export type CarryOverRecord = z.infer<typeof carryOverRecordSchema>;
export type CarryOverExecution = z.infer<typeof carryOverExecutionSchema>;
export type ArchiveReportSummary = z.infer<typeof archiveReportSummarySchema>;
export type ArchiveReportDetail = z.infer<typeof archiveReportDetailSchema>;

export const myHistoryEntrySchema = z.object({
  sectionId: z.string().uuid(),
  reportId: z.string().uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  reportStatus: reportStatusSchema,
  sectionStatus: reportSectionStatusSchema,
  submittedAt: z.coerce.date().nullable(),
  publishedAt: z.coerce.date().nullable(),
});

export type MyHistoryEntry = z.infer<typeof myHistoryEntrySchema>;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const paginationInputSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationInputSchema>;

export type PaginatedResult<T> = {
  items: T[];
  nextCursor: string | null;
};

export type DraftSaveValidationErrorCode =
  | 'SECTION_ALREADY_SUBMITTED'
  | 'MISSING_TRAFFIC_LIGHT'
  | 'MISSING_CURRENT_ITEM'
  | 'MISSING_PRIORITIES';

export type DraftSaveValidationError = {
  code: DraftSaveValidationErrorCode;
  message: string;
};

export function validateSubmitInput(
  section: ReportSectionReadModel,
  input: SubmitSectionInput | SubmitSectionPayload,
): DraftSaveValidationError[] {
  if (section.status === 'submitted') {
    return [
      {
        code: 'SECTION_ALREADY_SUBMITTED',
        message: 'Section has already been submitted.',
      },
    ];
  }

  const errors: DraftSaveValidationError[] = [];

  for (const project of section.projects) {
    const matchingStatus = input.projectStatuses.find(
      (status) => status.projectId === project.projectId,
    );

    if (!matchingStatus?.status) {
      errors.push({
        code: 'MISSING_TRAFFIC_LIGHT',
        message: `Project ${project.projectName} must have a traffic light status.`,
      });
    }

    const hasCurrentItem = input.items.some(
      (item) => item.projectId === project.projectId && item.type === 'current',
    );

    if (!hasCurrentItem) {
      errors.push({
        code: 'MISSING_CURRENT_ITEM',
        message: `Project ${project.projectName} needs at least one Current Week item.`,
      });
    }
  }

  if (input.priorities.length === 0) {
    errors.push({
      code: 'MISSING_PRIORITIES',
      message: 'At least one priority must be added before submit.',
    });
  } else if (input.priorities.some((priority) => priority.text.trim().length === 0)) {
    errors.push({
      code: 'MISSING_PRIORITIES',
      message: 'All priorities must be filled before submit.',
    });
  }

  return errors;
}
