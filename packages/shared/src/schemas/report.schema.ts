import { z } from "zod";

import {
  type periodStateSchema,
  periodStatusSchema,
  reportDate,
  reportSectionStatusSchema,
  reportStatusSchema,
  trafficLightStatusSchema,
} from "./report-primitives.schema";
import { reportSectionReadModelSchema } from "./section.schema";

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
  deadline: reportDate().nullable(),
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
  deadline: reportDate().nullable(),
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
