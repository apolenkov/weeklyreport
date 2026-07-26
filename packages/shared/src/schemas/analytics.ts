import { z } from "zod";

import { trafficLightStatusSchema } from "./report-primitives.schema";

const isoDateOnly = z.iso.date();

/** Input window for traffic-light history (optional project/lead filter). */
export const trafficLightHistoryInputSchema = z.object({
  projectId: z.uuid().optional(),
  leadId: z.uuid().optional(),
  periodFrom: isoDateOnly,
  periodTo: isoDateOnly,
});
/** Traffic-light history query input. */
export type TrafficLightHistoryInput = z.infer<
  typeof trafficLightHistoryInputSchema
>;

/** Nullable traffic-light status cell. */
export const trafficLightCellSchema = trafficLightStatusSchema.nullable();
/** One period status cell (null = no data). */
export type TrafficLightCell = z.infer<typeof trafficLightCellSchema>;

/** One project row of period statuses. */
export const trafficLightRowSchema = z.object({
  projectId: z.uuid(),
  projectName: z.string(),
  statuses: z.array(trafficLightCellSchema),
});
/** Traffic-light history row for a project. */
export type TrafficLightRow = z.infer<typeof trafficLightRowSchema>;

/** Periods × rows history matrix for the traffic-light chart. */
export const trafficLightHistoryOutputSchema = z.object({
  periods: z.array(isoDateOnly),
  rows: z.array(trafficLightRowSchema),
});
/** Traffic-light history response. */
export type TrafficLightHistoryOutput = z.infer<
  typeof trafficLightHistoryOutputSchema
>;

/** Lead submission velocity window input. */
export const leadVelocityInputSchema = z.object({
  periodFrom: isoDateOnly,
  periodTo: isoDateOnly,
});
/** Lead velocity query input. */
export type LeadVelocityInput = z.infer<typeof leadVelocityInputSchema>;

/** One period’s lead submission counts. */
export const leadVelocityRowSchema = z.object({
  periodLabel: isoDateOnly,
  leads: z.array(
    z.object({
      leadId: z.uuid(),
      leadName: z.string(),
      submittedSections: z.number().int().nonnegative(),
    }),
  ),
});
/** Lead velocity series (one row per period). */
export const leadVelocityOutputSchema = z.array(leadVelocityRowSchema);
/** Lead velocity response. */
export type LeadVelocityOutput = z.infer<typeof leadVelocityOutputSchema>;

/** Compare two ISO period dates. */
export const periodComparisonInputSchema = z.object({
  periodA: isoDateOnly,
  periodB: isoDateOnly,
});
/** Period comparison query input. */
export type PeriodComparisonInput = z.infer<typeof periodComparisonInputSchema>;

/** Per-project status and risk counts across two periods. */
export const periodComparisonRowSchema = z.object({
  projectId: z.uuid(),
  projectName: z.string(),
  statusA: trafficLightCellSchema,
  statusB: trafficLightCellSchema,
  riskCountA: z.number().int().nonnegative(),
  riskCountB: z.number().int().nonnegative(),
  riskDelta: z.number().int(),
});
/** Period comparison matrix response. */
export const periodComparisonOutputSchema = z.object({
  rows: z.array(periodComparisonRowSchema),
});
/** Period comparison response. */
export type PeriodComparisonOutput = z.infer<
  typeof periodComparisonOutputSchema
>;
