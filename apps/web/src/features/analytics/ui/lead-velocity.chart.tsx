"use client";

import type { LeadVelocityOutput } from "@customreport/shared";
import {
  ChartContainer,
  ChartTooltip,
} from "@customreport/ui/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

import { buildLeadVelocityChartData } from "./analytics-chart-data";
import { SERIES_PALETTE as COLORS } from "./chart-palette";

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
