import { z } from "zod";

import {
  periodStateSchema,
  periodStatusSchema,
  reportDate,
  reportSectionStatusSchema,
  reportStatusSchema,
  trafficLightStatusSchema,
} from "../primitives/report-primitives.schema";
import {
  publishedReportSectionReadModelSchema,
  reportSectionReadModelSchema,
} from "../report-sections/section.schema";

/**
 * Live lead-section activity row; `lastEditAt` is derived from child records.
 */
export const activityLiveRowSchema = z
  .object({
    reportId: z.uuid(),
    reportSectionId: z.uuid().nullable(),
    leadId: z.uuid(),
    leadName: z.string().min(1),
    // Closed publications do not consult mutable User rows. The address is
    // therefore unavailable on frozen activity rows; live rows still carry it.
    email: z.email().nullable(),
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
const assembledReportObjectSchema = z.object({
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
});

interface ReportIdentitySection {
  readonly reportSectionId: string;
  readonly authorId: string;
  readonly items: readonly { readonly id?: string | undefined }[];
  readonly risks: readonly { readonly id?: string | undefined }[];
  readonly decisions: readonly { readonly id?: string | undefined }[];
}

/**
 * Keeps every report snapshot collection addressable without ambiguity.
 * Record ids are namespaced by their frozen collection type: an item and a
 * risk may legitimately share a database id, while two items may not.
 */
function addReportIdentityIssues(
  report: { readonly sections: readonly ReportIdentitySection[] },
  context: z.RefinementCtx,
): void {
  const firstSectionIndexes = new Map(
    report.sections
      .map((section, index) => [section.reportSectionId, index] as const)
      .toReversed(),
  );
  const firstAuthorIndexes = new Map(
    report.sections
      .map((section, index) => [section.authorId, index] as const)
      .toReversed(),
  );
  const firstRecordLocations = new Map(
    report.sections
      .flatMap((section, sectionIndex) =>
        (
          [
            ["item", section.items],
            ["risk", section.risks],
            ["decision", section.decisions],
          ] as const
        ).flatMap(([recordType, records]) =>
          records.flatMap((record, recordIndex) =>
            record.id === undefined
              ? []
              : [
                  [
                    `${recordType}:${record.id}`,
                    [sectionIndex, `${recordType}s`, recordIndex] as const,
                  ] as const,
                ],
          ),
        ),
      )
      .toReversed(),
  );

  report.sections.forEach((section, sectionIndex) => {
    const previousSection = firstSectionIndexes.get(section.reportSectionId);
    if (previousSection !== undefined && previousSection !== sectionIndex) {
      context.addIssue({
        code: "custom",
        path: ["sections", sectionIndex, "reportSectionId"],
        message: `Section ${section.reportSectionId} is duplicated (also at index ${previousSection}).`,
      });
    }

    const previousAuthor = firstAuthorIndexes.get(section.authorId);
    if (previousAuthor !== undefined && previousAuthor !== sectionIndex) {
      context.addIssue({
        code: "custom",
        path: ["sections", sectionIndex, "authorId"],
        message: `Author ${section.authorId} is duplicated (also at section index ${previousAuthor}).`,
      });
    }

    const collections = [
      ["item", section.items],
      ["risk", section.risks],
      ["decision", section.decisions],
    ] as const;
    collections.forEach(([recordType, records]) => {
      records.forEach((record, recordIndex) => {
        if (record.id === undefined) return;
        const identity = `${recordType}:${record.id}` as const;
        const previous = firstRecordLocations.get(identity);
        if (
          previous !== undefined &&
          (previous[0] !== sectionIndex || previous[2] !== recordIndex)
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "sections",
              sectionIndex,
              `${recordType}s`,
              recordIndex,
              "id",
            ],
            message: `Record identity ${identity} is duplicated (also at section index ${previous[0]}, ${previous[1]} index ${previous[2]}).`,
          });
        }
      });
    });
  });
}

/** Validates the mutable assembled report read model and its publication invariant. */
export const assembledReportSchema = assembledReportObjectSchema
  .superRefine(addReportIdentityIssues)
  .superRefine((report, context) => {
    if (report.status === "published" && report.publishedAt === null) {
      context.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Published reports require a publication timestamp.",
      });
    }
  })
  .readonly();

/**
 * Immutable publication payload. Unlike a live assembled draft, every section
 * must carry its publish-time author group so restored reports remain safely
 * scopeable without mutable ReportSection/User relations.
 */
export const publishedReportSnapshotSchema = assembledReportObjectSchema
  .extend({
    status: z.literal("published"),
    publishedAt: z.coerce.date(),
    sections: z.array(publishedReportSectionReadModelSchema).readonly(),
  })
  .superRefine(addReportIdentityIssues)
  .readonly();

/** Defines the lifecycle states exposed for an asynchronous PDF export. */
export const pdfExportStatusSchema = z.enum(["queued", "completed", "failed"]);

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

/** Stable identities prevent display-name collisions in downstream joins. */
const escalationIdentityShape = {
  productId: z.uuid(),
  productName: z.string().min(1),
  authorId: z.uuid(),
  leadName: z.string().min(1),
  description: z.string(),
};

/** Describes a head-facing call-out that requires attention. */
export const escalationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("blocked"),
      ...escalationIdentityShape,
      stageName: z.string().min(1),
    })
    .readonly(),
  z
    .object({
      type: z.literal("unresolved_risk"),
      ...escalationIdentityShape,
      stageName: z.string().min(1),
    })
    .readonly(),
  z
    .object({
      type: z.literal("at_risk"),
      ...escalationIdentityShape,
      stageName: z.string().nullable(),
    })
    .readonly(),
]);

/** Describes the live weekly report state consumed by report pages. */
export const weeklyReportReadModelSchema = z
  .object({
    reportId: z.uuid(),
    periodStart: reportDate(),
    periodEnd: reportDate(),
    deadline: reportDate().nullable(),
    periodState: periodStateSchema,
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
    // Null means no sendable deadline rule (including closed publications).
    // The concrete id is carried through manual dispatch to avoid selecting an
    // unrelated escalation rule after the capability check.
    activeDeadlineReminderRuleId: z.uuid().nullable(),
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
/** Immutable, ownership-complete publication snapshot. */
export type PublishedReportSnapshot = z.infer<
  typeof publishedReportSnapshotSchema
>;
/** Observable state and artifact metadata of a PDF export job. */
export type PdfExportJob = z.infer<typeof pdfExportJobSchema>;
