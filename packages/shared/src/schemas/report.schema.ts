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
 * Live lead-section activity row; `lastEditAt` is derived from child records.
 */
export const activityLiveRowSchema = z
  .object({
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
  })
  .readonly();

/** Live submission activity for one lead in the current reporting period. */
export type ActivityLiveRow = z.infer<typeof activityLiveRowSchema>;

/** Describes live lead activity and period context for the admin dashboard. */
export const activityLiveResponseSchema = z
  .object({
    reportId: z.uuid().nullable(),
    periodStart: reportDate().nullable(),
    periodEnd: reportDate().nullable(),
    periodStatus: periodStatusSchema.nullable(),
    rows: z.array(activityLiveRowSchema).readonly(),
  })
  .readonly();

/** Live activity dashboard state for the current reporting period. */
export type ActivityLiveResponse = z.infer<typeof activityLiveResponseSchema>;

/** Describes aggregate traffic-light totals for an assembled report. */
export const portfolioOverviewSchema = z
  .object({
    status: trafficLightStatusSchema,
    totals: z
      .object({
        green: z.number().int().min(0),
        yellow: z.number().int().min(0),
        red: z.number().int().min(0),
      })
      .readonly(),
  })
  .readonly();

/** Describes the immutable report document consumed by export surfaces. */
export const assembledReportSchema = z
  .object({
    reportId: z.uuid(),
    periodStart: reportDate(),
    periodEnd: reportDate(),
    deadline: reportDate().nullable(),
    status: reportStatusSchema,
    publishedAt: z.coerce.date().nullable(),
    publishedById: z.uuid().nullable(),
    publishedByName: z.string().min(1).nullable(),
    portfolioOverview: portfolioOverviewSchema,
    sections: z.array(reportSectionReadModelSchema).readonly(),
  })
  .readonly();

/** Defines the lifecycle states exposed for an asynchronous PDF export. */
export const pdfExportStatusSchema = z.enum(["queued", "completed", "failed"]);

/** Accepts the report identity submitted to the PDF export queue. */
export const pdfExportRequestSchema = z
  .object({
    reportId: z.uuid(),
  })
  .readonly();

/** Describes the observable state and artifact metadata of a PDF export job. */
export const pdfExportJobSchema = z
  .object({
    jobId: z.uuid(),
    reportId: z.uuid(),
    status: pdfExportStatusSchema,
    requestedAt: z.coerce.date(),
    completedAt: z.coerce.date().nullable(),
    checksum: z.string().nullable(),
    templateVersion: z.string().min(1),
    artifactUrl: z.string().min(1).nullable(),
  })
  .readonly();

/**
 * Status target behind `/reports/latest`: the current editable period when it
 * has a viewer-visible section, else the newest viewer-visible `published`
 * report, else `null` (empty state).
 */
export const latestForViewerReportSchema = z
  .object({
    reportId: z.uuid().nullable(),
  })
  .readonly();
/** Viewer status target resolved from the current or latest published report. */
export type LatestForViewerReport = z.infer<typeof latestForViewerReportSchema>;

/** Describes one product's aggregate status in the report overview. */
export const portfolioProductOverviewSchema = z
  .object({
    productId: z.uuid(),
    productName: z.string().min(1),
    worstStatus: trafficLightStatusSchema.nullable(),
    stageCount: z.number().int().min(0),
    leadIds: z.array(z.uuid()).readonly(),
    leadNames: z.array(z.string().min(1)).readonly(),
  })
  .readonly();

/** Describes a head-facing call-out that requires attention. */
export const escalationSchema = z
  .object({
    type: z.enum(["blocked", "at_risk", "unresolved_risk"]),
    productName: z.string().min(1),
    stageName: z.string().nullable(),
    leadName: z.string().min(1),
    description: z.string(),
  })
  .readonly();

/** Describes the live weekly report state consumed by report pages. */
export const weeklyReportReadModelSchema = z
  .object({
    reportId: z.uuid(),
    periodStart: reportDate(),
    periodEnd: reportDate(),
    deadline: reportDate().nullable(),
    periodStatus: periodStatusSchema,
    // Archiving leaves `periodStatus` at "published", so this is the only signal
    // that separates an archived report from a live published one.
    archived: z.boolean(),
    weekLabel: z.string().nullable(),
    // `departmentName` is NOT on the weekly read model. Frontends pull the
    // brand label from `auth.me.organization` hydrated on every authenticated
    // request (one source of truth).
    submissionCount: z.number().int().min(0),
    totalLeads: z.number().int().min(0),
    hasActiveReminderRule: z.boolean(),
    portfolioOverview: z.array(portfolioProductOverviewSchema).readonly(),
    leadSections: z.array(reportSectionReadModelSchema).readonly(),
    escalations: z.array(escalationSchema).readonly(),
  })
  .readonly();

/**
 * Response for `weeklyReport.get`. With no active Period the procedure returns
 * the `no-period` sentinel rather than throwing NOT_FOUND, so consumers branch
 * on `status` instead of treating an ordinary empty state as a query failure.
 */
export const weeklyReportGetResponseSchema = z
  .discriminatedUnion("status", [
    weeklyReportReadModelSchema
      .unwrap()
      .extend({ status: z.literal("active") })
      .readonly(),
    z.object({ status: z.literal("no-period"), report: z.null() }).readonly(),
  ])
  .readonly();

/** Lifecycle status stored on a reporting period. */
export type PeriodStatus = z.infer<typeof periodStatusSchema>;
/** Full reporting-period state including archive status. */
export type PeriodState = z.infer<typeof periodStateSchema>;
/** Aggregate status for one product in the report overview. */
export type PortfolioProductOverview = z.infer<
  typeof portfolioProductOverviewSchema
>;
/** Head-facing report call-out requiring attention. */
export type Escalation = z.infer<typeof escalationSchema>;
/** Live weekly report state returned to report pages. */
export type WeeklyReportReadModel = z.infer<typeof weeklyReportReadModelSchema>;
/** Active weekly report or explicit no-period response. */
export type WeeklyReportGetResponse = z.infer<
  typeof weeklyReportGetResponseSchema
>;

/** Aggregate traffic-light totals for an assembled report. */
export type PortfolioOverview = z.infer<typeof portfolioOverviewSchema>;
/** Immutable report document consumed by export surfaces. */
export type AssembledReport = z.infer<typeof assembledReportSchema>;
/** Report identity admitted by the asynchronous PDF export queue. */
export type PdfExportRequest = z.infer<typeof pdfExportRequestSchema>;
/** Observable state and artifact metadata of a PDF export job. */
export type PdfExportJob = z.infer<typeof pdfExportJobSchema>;
