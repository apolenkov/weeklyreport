import { z } from "zod";

/**
 * Phase 52 (UFB-054) — `telemetry.summary` payload shape.
 *
 * Exposed to head / admin / viewer roles via the tRPC procedure of the
 * same name; rendered in-app on `/dashboard` as the KPI card so users
 * see the same numbers as the Grafana «Product KPIs» dashboard without
 * leaving the product.
 *
 * Field origin map (each field traces to a `customreport_*` series so
 * dashboard reasoning and in-app reasoning stay in lockstep):
 *
 *   reportsThisPeriod       — Report rows in the current open period
 *   onTimeRatio             — customreport_reports_on_time_ratio
 *   activeLeads             — customreport_active_leads_total
 *   lateSections            — sum of late=true section count, last period
 *   pendingReopens          — ReopenRequest rows with status='pending'
 *   pdfExportsLast7d        — counter increase over 7d, sum across roles
 *   sparkline               — 4-week on-time ratio per period (oldest→newest)
 *
 * `sparkline` is `number[]` length ≤ 4. Each entry is the on-time ratio
 * for that period; missing periods are filtered out so the consumer
 * does not need null-handling logic.
 */
export const telemetrySummarySchema = z.object({
  reportsThisPeriod: z.number().int().nonnegative(),
  onTimeRatio: z.number().min(0).max(1).nullable(),
  activeLeads: z.number().int().nonnegative(),
  lateSections: z.number().int().nonnegative(),
  pendingReopens: z.number().int().nonnegative(),
  pdfExportsLast7d: z.number().int().nonnegative(),
  sparkline: z.array(z.number().min(0).max(1)).max(4),
});

export type TelemetrySummary = z.infer<typeof telemetrySummarySchema>;
