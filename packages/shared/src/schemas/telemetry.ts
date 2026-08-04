import { z } from "zod";

const SPARKLINE_PERIOD_COUNT = 4;

/** Validates the in-product KPI summary and its bounded oldest-first sparkline. */
export const telemetrySummarySchema = z
  .object({
    reportsThisPeriod: z.number().int().nonnegative(),
    onTimeRatio: z.number().min(0).max(1).nullable(),
    activeLeads: z.number().int().nonnegative(),
    lateSections: z.number().int().nonnegative(),
    pendingReopens: z.number().int().nonnegative(),
    pdfExportsLast7d: z.number().int().nonnegative(),
    sparkline: z
      .array(z.number().min(0).max(1))
      .max(SPARKLINE_PERIOD_COUNT)
      .readonly(),
  })
  .readonly();

/** KPI aggregates with a bounded oldest-first sparkline. */
export type TelemetrySummary = z.infer<typeof telemetrySummarySchema>;
