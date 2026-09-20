"use client";

import type { TrafficLightHistoryOutput } from "@customreport/shared";
import {
  ChartContainer,
  ChartTooltip,
} from "@customreport/ui/components/ui/chart";
import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  buildTrafficLightHistoryChartData,
  formatTrafficLightStatusLevel,
} from "./analytics-chart-data";
import { SERIES_PALETTE as COLORS } from "./chart-palette";

// Domain max leaves headroom above green so the top line isn't clipped.
const STATUS_LEVEL_GREEN = 3;
const STATUS_LEVEL_TICKS = [1, 2, STATUS_LEVEL_GREEN];
const Y_AXIS_DOMAIN_MAX = 4;
function formatTrafficLightStatus(
  status: TrafficLightHistoryOutput["rows"][number]["statuses"][number],
): string {
  if (status === null) return "No data";
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function TrafficLightHistoryDataTable({
  periods,
  rows,
}: TrafficLightHistoryOutput) {
  return (
    <div className="sr-only">
      <table>
        <caption>Traffic-light history data</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {rows.map((row) => (
              <th key={row.projectId} scope="col">
                {row.projectName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period, periodIndex) => (
            <tr key={period}>
              <th scope="row">{period}</th>
              {rows.map((row) => (
                <td key={row.projectId}>
                  {formatTrafficLightStatus(row.statuses[periodIndex] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
    <>
      <ChartContainer>
        <LineChart data={data} aria-label="Traffic-light history">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis
            ticks={STATUS_LEVEL_TICKS}
            domain={[0, Y_AXIS_DOMAIN_MAX]}
            tickFormatter={formatTrafficLightStatusLevel}
            width={64}
          />
          <ChartTooltip
            formatter={(value) =>
              typeof value === "number"
                ? formatTrafficLightStatusLevel(value)
                : value
            }
          />
          <Legend />
          {/* connectNulls={false}: periods a project did NOT report stay visible
              gaps instead of being bridged by a line through them. */}
          {series.map((s, idx) => (
            <Line
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              stroke={COLORS[idx % COLORS.length] as string}
              strokeWidth={2}
              connectNulls={false}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ChartContainer>

      <TrafficLightHistoryDataTable periods={periods} rows={rows} />
    </>
  );
}
