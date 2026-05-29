"use client";

import type {
  TrafficLightCell,
  TrafficLightHistoryOutput,
} from "@customreport/shared";

import {
  ChartContainer,
  ChartTooltip,
} from "@customreport/ui/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

/**
 * ANAL-04 (Phase 30-03): traffic-light history sparkline.
 *
 * `connectNulls={false}` so periods where a project did NOT report render
 * as visible gaps, distinct from a reported zero. status mapping: green=3,
 * yellow=2, red=1, null=null.
 */

const STATUS_TO_VALUE: Record<Exclude<TrafficLightCell, null>, number> = {
  green: 3,
  yellow: 2,
  red: 1,
};

const COLORS = [
  "#15803d",
  "#2563eb",
  "#9333ea",
  "#0891b2",
  "#c2410c",
  "#a21caf",
];

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

  const data = periods.map((label, idx) => {
    const point: Record<string, number | string | null> = { period: label };
    for (const row of rows) {
      const cell = row.statuses[idx] ?? null;
      point[row.projectName] = cell === null ? null : STATUS_TO_VALUE[cell];
    }
    return point;
  });

  return (
    <ChartContainer>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis ticks={[1, 2, 3]} domain={[0, 4]} />
        <ChartTooltip />
        {rows.map((row, idx) => (
          <Line
            key={row.projectId}
            dataKey={row.projectName}
            stroke={COLORS[idx % COLORS.length]}
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
