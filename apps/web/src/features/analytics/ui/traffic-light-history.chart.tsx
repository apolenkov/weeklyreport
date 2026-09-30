"use client";

import {
  type TrafficLightHistoryOutput,
  trafficLightToCanonical,
} from "@customreport/shared";

import { worstTrafficStatus } from "../../../shared/lib/status/status-presentation";
import { SlideStatusBadge } from "../../../shared/ui/feedback/slide-status-badge";

export function TrafficLightHistoryChart({
  periods,
  rows,
  headingId,
}: TrafficLightHistoryOutput & { readonly headingId: string }) {
  if (periods.length === 0 || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No published periods in range.
      </p>
    );
  }

  const rankedRows = rows
    .map((row) => {
      const worst = worstTrafficStatus(row.statuses);
      return { row, rank: worst === "red" ? 0 : worst === "yellow" ? 1 : 2 };
    })
    .toSorted((a, b) => a.rank - b.rank);

  return (
    <div
      className="max-w-full overflow-x-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
      tabIndex={0}
      role="region"
      aria-labelledby={headingId}
    >
      <table className="min-w-full border-collapse text-sm">
        <caption className="pb-3 text-left text-muted-foreground">
          Traffic-light history data
        </caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="px-3 py-2">
              Project
            </th>
            {periods.map((period) => (
              <th
                key={period}
                scope="col"
                className="whitespace-nowrap px-3 py-2"
              >
                {period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rankedRows.map(({ row }) => (
            <tr key={row.projectId} className="border-b last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {row.projectName}
              </th>
              {periods.map((period, index) => (
                <td key={period} className="whitespace-nowrap px-3 py-2">
                  <SlideStatusBadge
                    status={trafficLightToCanonical(
                      row.statuses[index] ?? null,
                    )}
                    labelVariant="screen"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
