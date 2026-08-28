"use client";

import type { TrafficLightHistoryOutput } from "@customreport/shared";
import {
  ChartContainer,
  ChartTooltip,
} from "@customreport/ui/components/ui/chart";
import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";

import { buildTrafficLightHistoryChartData } from "./analytics-chart-data";
import { SERIES_PALETTE as COLORS } from "./chart-palette";

// Domain max leaves headroom above green so the top line isn't clipped.
const STATUS_LEVEL_GREEN = 3;
const STATUS_LEVEL_TICKS = [1, 2, STATUS_LEVEL_GREEN];
const Y_AXIS_DOMAIN_MAX = 4;
const STATUS_LEVEL_LABELS: Readonly<Record<number, string>> = {
  1: "Red",
  2: "Yellow",
  [STATUS_LEVEL_GREEN]: "Green",
};

export function formatTrafficLightStatusLevel(value: number): string {
  return STATUS_LEVEL_LABELS[value] ?? String(value);
}

export function TrafficLightHistoryChart({
  periods,
  rows,
}: TrafficLightHistoryOutput) {
  if (periods.length === 0 || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No published periods in range.
      </p>
    );
  }

  const { data, series } = buildTrafficLightHistoryChartData(periods, rows);

  return (
    <ChartContainer>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis
          ticks={STATUS_LEVEL_TICKS}
          domain={[0, Y_AXIS_DOMAIN_MAX]}
          tickFormatter={formatTrafficLightStatusLevel}
          width={64}
        />
        <ChartTooltip />
        <Legend />
        {/* connectNulls={false}: periods a project did NOT report stay visible
            gaps instead of being bridged by a line through them. */}
        {series.map((s, idx) => (
          <Line
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.name}
            stroke={COLORS[idx % COLORS.length] ?? "currentColor"}
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
