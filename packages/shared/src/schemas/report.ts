import { z } from 'zod';

import { roleSchema } from './auth';

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

export const projectStatusInputSchema = z.object({
  projectId: z.string().uuid(),
  status: trafficLightStatusSchema.optional(),
});

export const itemInputSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  type: itemTypeSchema,
  text: z.string().min(1).max(500),
  tag: z.string().min(1).max(50),
  workflowStatus: itemWorkflowStatusSchema,
  carriedOver: z.boolean().default(false),
  completed: z.boolean().nullable().optional(),
});

export const riskInputSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  risk: z.string().min(1).max(500),
  impact: z.string().min(1).max(500),
  mitigation: z.string().min(1).max(500),
});

export const decisionInputSchema = z.object({
  id: z.string().uuid().optional(),
  text: z.string().min(1).max(500),
  owner: z.string().min(1).max(200),
  deadline: z.coerce.date().nullable().optional(),
  impact: z.string().min(1).max(500),
  resolvedAt: z.coerce.date().nullable().optional(),
});

export const priorityInputSchema = z.object({
  id: z.string().uuid().optional(),
  rank: z.number().int().min(1).max(3),
  text: z.string().min(1).max(200),
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
  priorities: z.array(priorityInputSchema).length(3).refine(
    (priorities) => {
      const ranks = priorities.map((p) => p.rank);
      return new Set(ranks).size === ranks.length;
    },
    { message: 'Priority ranks must be unique' },
  ),
});

export const projectReadModelSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string().min(1),
  trafficLight: trafficLightStatusSchema.nullable(),
});

export const reportSectionReadModelSchema = z.object({
  reportSectionId: z.string().uuid(),
  reportId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string().min(1),
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

export const adminReminderRuleKindSchema = z.enum(['deadline', 'follow_up']);
export const adminReminderRuleStatusSchema = z.enum(['active', 'paused']);

export const adminReminderRuleSchema = z.object({
  id: z.string().uuid(),
  reportId: z.string().uuid(),
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
  reportId: z.string().uuid(),
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

export type DraftSavePayload = z.input<typeof draftSaveSchema>;
export type DraftSaveInput = z.infer<typeof draftSaveSchema>;
export type SubmitSectionPayload = z.input<typeof submitSectionSchema>;
export type SubmitSectionInput = z.infer<typeof submitSectionSchema>;
export type ReportSectionReadModel = z.infer<typeof reportSectionReadModelSchema>;
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

  if (
    input.priorities.length !== 3 ||
    input.priorities.some((priority) => priority.text.trim().length === 0)
  ) {
    errors.push({
      code: 'MISSING_PRIORITIES',
      message: 'Top 3 priorities must be filled before submit.',
    });
  }

  return errors;
}
