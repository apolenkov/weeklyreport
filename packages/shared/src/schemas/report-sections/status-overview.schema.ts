import { z } from "zod";

import { reportDate } from "../primitives/report-primitives.schema";
import {
  publishedReportSectionReadModelSchema,
  reportSectionReadModelSchema,
} from "./section.schema";

/** Identifies the selected report and optional section author for Overview. */
export const leadStatusOverviewInputSchema = z
  .object({
    reportId: z.uuid(),
    authorId: z.uuid().optional(),
  })
  .readonly();

const periodIdentitySchema = z
  .object({
    reportId: z.uuid(),
    periodStart: reportDate(),
    periodEnd: reportDate(),
  })
  .readonly();

const currentStatusOverviewPeriodSchema = periodIdentitySchema
  .unwrap()
  .extend({ section: reportSectionReadModelSchema })
  .readonly();

const publishedPredecessorSchema = periodIdentitySchema
  .unwrap()
  .extend({
    availability: z.literal("available"),
    source: z.literal("published"),
    section: publishedReportSectionReadModelSchema,
  })
  .readonly();

const submittedSectionSchema = reportSectionReadModelSchema
  .unwrap()
  .extend({ status: z.literal("submitted") })
  .readonly();

const submittedPredecessorSchema = periodIdentitySchema
  .unwrap()
  .extend({
    availability: z.literal("available"),
    source: z.literal("submitted"),
    section: submittedSectionSchema,
  })
  .readonly();

const noPredecessorSchema = z
  .object({
    availability: z.literal("unavailable"),
    reason: z.literal("no_predecessor"),
  })
  .readonly();

const unavailablePredecessorPeriodSchema = periodIdentitySchema
  .unwrap()
  .extend({
    availability: z.literal("unavailable"),
    reason: z.enum(["section_unavailable", "invalid_published_snapshot"]),
  })
  .readonly();

/** Describes the authoritative immediate-predecessor source, or why it is absent. */
export const leadStatusOverviewPredecessorSchema = z.union([
  publishedPredecessorSchema,
  submittedPredecessorSchema,
  noPredecessorSchema,
  unavailablePredecessorPeriodSchema,
]);

/** Validated read-only temporal sources used by the compact lead Overview. */
export const leadStatusOverviewOutputSchema = z
  .object({
    current: currentStatusOverviewPeriodSchema,
    predecessor: leadStatusOverviewPredecessorSchema,
  })
  .superRefine((overview, context) => {
    if (overview.current.reportId !== overview.current.section.reportId) {
      context.addIssue({
        code: "custom",
        path: ["current", "section", "reportId"],
        message: "Current section must belong to the selected report.",
      });
    }
    const predecessor = overview.predecessor;
    if (
      predecessor.availability === "available" &&
      predecessor.reportId !== predecessor.section.reportId
    ) {
      context.addIssue({
        code: "custom",
        path: ["predecessor", "section", "reportId"],
        message: "Predecessor section must belong to its period.",
      });
    }
    if (
      predecessor.availability === "available" &&
      predecessor.periodStart >= overview.current.periodStart
    ) {
      context.addIssue({
        code: "custom",
        path: ["predecessor", "periodStart"],
        message: "Predecessor period must begin before the selected period.",
      });
    }
  })
  .readonly();

/** Raw input accepted by the compact lead Overview query. */
export type LeadStatusOverviewInput = z.input<
  typeof leadStatusOverviewInputSchema
>;
/** Authoritative predecessor state returned to compact Overview clients. */
export type LeadStatusOverviewPredecessor = z.infer<
  typeof leadStatusOverviewPredecessorSchema
>;
/** Validated temporal source bundle returned to compact Overview clients. */
export type LeadStatusOverviewOutput = z.infer<
  typeof leadStatusOverviewOutputSchema
>;
