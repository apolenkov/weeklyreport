"use client";

import type { LeadVelocityOutput } from "@customreport/shared";
import {
  ChartContainer,
  ChartTooltip,
} from "@customreport/ui/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";

import { buildLeadVelocityChartData } from "./analytics-chart-data";
import {
  type ChartData,
  type ChartSeries,
  SERIES_PALETTE as COLORS,
} from "./chart-palette";

function LeadVelocityDataTable({
  data,
  series,
}: {
  readonly data: readonly ChartData[];
  readonly series: readonly ChartSeries[];
}) {
  return (
    <table className="sr-only">
      <caption>Lead velocity data in submitted sections</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          {series.map((lead) => (
            <th key={lead.dataKey} scope="col">
              {lead.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((point) => (
          <tr key={String(point.period)}>
            <th scope="row">{point.period}</th>
            {series.map((lead) => (
              <td key={lead.dataKey}>{point[lead.dataKey] ?? 0}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

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
    <>
      <ChartContainer aria-hidden="true">
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

      <LeadVelocityDataTable data={data} series={series} />
    </>
  );
}
