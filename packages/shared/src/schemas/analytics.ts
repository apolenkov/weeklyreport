import { z } from "zod";

import { trafficLightStatusSchema } from "./report-primitives.schema";

const ISO_DATE_LENGTH = "YYYY-MM-DD".length;

// Regex alone accepts 2026-02-30; refine requires UTC round-trip to the same YYYY-MM-DD.
const isoDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) => {
      const d = new Date(`${s}T00:00:00.000Z`);
      return (
        !Number.isNaN(d.getTime()) &&
        d.toISOString().slice(0, ISO_DATE_LENGTH) === s
      );
    },
    { message: "Not a real calendar date" },
  );

export const trafficLightHistoryInputSchema = z.object({
  projectId: z.uuid().optional(),
  leadId: z.uuid().optional(),
  periodFrom: isoDateOnly,
  periodTo: isoDateOnly,
});
export type TrafficLightHistoryInput = z.infer<
  typeof trafficLightHistoryInputSchema
>;

export const trafficLightCellSchema = trafficLightStatusSchema.nullable();
export type TrafficLightCell = z.infer<typeof trafficLightCellSchema>;

export const trafficLightRowSchema = z.object({
  projectId: z.uuid(),
  projectName: z.string(),
  statuses: z.array(trafficLightCellSchema),
});
export type TrafficLightRow = z.infer<typeof trafficLightRowSchema>;

export const trafficLightHistoryOutputSchema = z.object({
  periods: z.array(isoDateOnly),
  rows: z.array(trafficLightRowSchema),
});
export type TrafficLightHistoryOutput = z.infer<
  typeof trafficLightHistoryOutputSchema
>;

export const leadVelocityInputSchema = z.object({
  periodFrom: isoDateOnly,
  periodTo: isoDateOnly,
});
export type LeadVelocityInput = z.infer<typeof leadVelocityInputSchema>;

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
export const leadVelocityOutputSchema = z.array(leadVelocityRowSchema);
export type LeadVelocityOutput = z.infer<typeof leadVelocityOutputSchema>;

export const periodComparisonInputSchema = z.object({
  periodA: isoDateOnly,
  periodB: isoDateOnly,
});
export type PeriodComparisonInput = z.infer<typeof periodComparisonInputSchema>;

export const periodComparisonRowSchema = z.object({
  projectId: z.uuid(),
  projectName: z.string(),
  statusA: trafficLightCellSchema,
  statusB: trafficLightCellSchema,
  riskCountA: z.number().int().nonnegative(),
  riskCountB: z.number().int().nonnegative(),
  riskDelta: z.number().int(),
});
export const periodComparisonOutputSchema = z.object({
  rows: z.array(periodComparisonRowSchema),
});
export type PeriodComparisonOutput = z.infer<
  typeof periodComparisonOutputSchema
>;
