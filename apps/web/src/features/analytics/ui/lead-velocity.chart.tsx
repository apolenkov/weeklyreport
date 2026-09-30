"use client";

import type { LeadVelocityOutput } from "@customreport/shared";

import { buildLeadVelocityChartData } from "./analytics-chart-data";

export function LeadVelocityChart({
  rows,
  headingId,
}: {
  readonly rows: LeadVelocityOutput;
  readonly headingId: string;
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
    <div
      className="max-w-full overflow-x-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
      tabIndex={0}
      role="region"
      aria-labelledby={headingId}
    >
      <table className="min-w-full border-collapse text-sm">
        <caption className="pb-3 text-left text-muted-foreground">
          Lead velocity data in submitted sections
        </caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="px-3 py-2">
              Lead
            </th>
            {data.map((point) => (
              <th
                key={String(point.period)}
                scope="col"
                className="whitespace-nowrap px-3 py-2"
              >
                {point.period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.map((lead) => (
            <tr key={lead.dataKey} className="border-b last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {lead.name}
              </th>
              {data.map((point) => {
                const count = point[lead.dataKey] ?? 0;
                return (
                  <td
                    key={String(point.period)}
                    className={`px-3 py-2 ${count === 0 ? "text-muted-foreground" : ""}`}
                  >
                    {count}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
