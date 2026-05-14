import { z } from "zod";

const isoDateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const trafficLightHistoryInputSchema = z.object({
  projectId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  periodFrom: isoDateOnly,
  periodTo: isoDateOnly,
});
export type TrafficLightHistoryInput = z.infer<
  typeof trafficLightHistoryInputSchema
>;

export const trafficLightCellSchema = z
  .enum(["green", "yellow", "red"])
  .nullable();
export type TrafficLightCell = z.infer<typeof trafficLightCellSchema>;

export const trafficLightRowSchema = z.object({
  projectId: z.string().uuid(),
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
      leadId: z.string().uuid(),
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
  projectId: z.string().uuid(),
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
