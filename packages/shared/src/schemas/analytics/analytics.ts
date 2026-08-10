import { z } from "zod";

import { trafficLightStatusSchema } from "../primitives/report-primitives.schema";

const isoDateOnly = z.iso.date();

/** Input window for traffic-light history (optional project/lead filter). */
export const trafficLightHistoryInputSchema = z
  .object({
    projectId: z.uuid().optional(),
    leadId: z.uuid().optional(),
    periodFrom: isoDateOnly,
    periodTo: isoDateOnly,
  })
  .readonly();
/** Traffic-light history query input. */
export type TrafficLightHistoryInput = z.infer<
  typeof trafficLightHistoryInputSchema
>;

/** Nullable traffic-light status cell. */
export const trafficLightCellSchema = trafficLightStatusSchema.nullable();
/** One period status cell (null = no data). */
export type TrafficLightCell = z.infer<typeof trafficLightCellSchema>;

/** One project row of period statuses. */
export const trafficLightRowSchema = z
  .object({
    projectId: z.uuid(),
    projectName: z.string(),
    statuses: z.array(trafficLightCellSchema).readonly(),
  })
  .readonly();
/** Traffic-light history row for a project. */
export type TrafficLightRow = z.infer<typeof trafficLightRowSchema>;

/** Periods × rows history matrix for the traffic-light chart. */
export const trafficLightHistoryOutputSchema = z
  .object({
    periods: z.array(isoDateOnly).readonly(),
    rows: z.array(trafficLightRowSchema).readonly(),
  })
  .superRefine(({ periods, rows }, context) => {
    rows.forEach((row, index) => {
      if (row.statuses.length !== periods.length) {
        context.addIssue({
          code: "custom",
          path: ["rows", index, "statuses"],
          message: "Status count must match period count.",
        });
      }
    });
  })
  .readonly();
/** Traffic-light history response. */
export type TrafficLightHistoryOutput = z.infer<
  typeof trafficLightHistoryOutputSchema
>;

/** Lead submission velocity window input. */
export const leadVelocityInputSchema = z
  .object({
    periodFrom: isoDateOnly,
    periodTo: isoDateOnly,
  })
  .readonly();
/** Lead velocity query input. */
export type LeadVelocityInput = z.infer<typeof leadVelocityInputSchema>;

/** One period’s lead submission counts. */
export const leadVelocityRowSchema = z
  .object({
    periodLabel: isoDateOnly,
    leads: z
      .array(
        z
          .object({
            leadId: z.uuid(),
            leadName: z.string(),
            submittedSections: z.number().int().nonnegative(),
          })
          .readonly(),
      )
      .readonly(),
  })
  .readonly();
/** Lead velocity series (one row per period). */
export const leadVelocityOutputSchema = z
  .array(leadVelocityRowSchema)
  .readonly();
/** Lead velocity response. */
export type LeadVelocityOutput = z.infer<typeof leadVelocityOutputSchema>;

/** Compare two ISO period dates. */
export const periodComparisonInputSchema = z
  .object({
    periodA: isoDateOnly,
    periodB: isoDateOnly,
  })
  .readonly();
/** Period comparison query input. */
export type PeriodComparisonInput = z.infer<typeof periodComparisonInputSchema>;

/** Per-project status and risk counts across two periods. */
export const periodComparisonRowSchema = z
  .object({
    projectId: z.uuid(),
    projectName: z.string(),
    statusA: trafficLightCellSchema,
    statusB: trafficLightCellSchema,
    riskCountA: z.number().int().nonnegative(),
    riskCountB: z.number().int().nonnegative(),
    riskDelta: z.number().int(),
  })
  .readonly();
/** Period comparison matrix response. */
export const periodComparisonOutputSchema = z
  .object({
    rows: z.array(periodComparisonRowSchema).readonly(),
  })
  .readonly();
/** Period comparison response. */
export type PeriodComparisonOutput = z.infer<
  typeof periodComparisonOutputSchema
>;
