"use client";

import type { LeadVelocityOutput } from "@customreport/shared";
import {
  ChartContainer,
  ChartTooltip,
} from "@customreport/ui/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

import { type ChartData, type ChartSeries, COLORS } from "./chart-palette";

// Key by leadId (UUID), not display name, so two leads with the same name
// keep separate columns.
/**
 * Build Lead Velocity Chart Data.
 * @param rows - The rows argument.
 */
export function buildLeadVelocityChartData(rows: LeadVelocityOutput): {
  readonly data: readonly ChartData[];
  readonly series: readonly ChartSeries[];
} {
  const leadIds = Array.from(
    new Set(rows.flatMap((r) => r.leads.map((l) => l.leadId))),
  );
  const leadNameById = new Map(
    rows.flatMap((r) => r.leads.map((l) => [l.leadId, l.leadName] as const)),
  );

  const series = leadIds.map((id) => ({
    dataKey: id,
    name: leadNameById.get(id) ?? id,
  }));

  const data = rows.map((r): ChartData =>
    leadIds.reduce<ChartData>(
      (point, id) => ({
        ...point,
        [id]: r.leads.find((l) => l.leadId === id)?.submittedSections ?? 0,
      }),
      { period: r.periodLabel },
    ),
  );

  return { data, series };
}

/**
 * Lead Velocity Chart.
 * @param options - The options argument.
 */
export function LeadVelocityChart({
  rows,
}: {
  readonly rows: LeadVelocityOutput;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No velocity data in range.
      </p>
    );
  }

  const { data, series } = buildLeadVelocityChartData(rows);

  return (
    <ChartContainer>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis allowDecimals={false} />
        <ChartTooltip />
        <Legend />
        {series.map((s, idx) => (
          <Bar
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.name}
            stackId="leads"
            fill={COLORS[idx % COLORS.length]}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
