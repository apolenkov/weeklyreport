"use client";

import {
  CANONICAL_STATUS_PRECEDENCE,
  type CanonicalStatus,
  canonicalStatusSchema,
  type TrafficLightHistoryOutput,
  trafficLightToCanonical,
} from "@customreport/shared";

import { worstTrafficStatus } from "../../../shared/lib/status/status-presentation";
import { SlideStatusBadge } from "../../../shared/ui/feedback/slide-status-badge";

function StatusChange({
  previous,
  current,
}: {
  readonly previous: CanonicalStatus;
  readonly current: CanonicalStatus;
}) {
  if (previous === "empty" || current === "empty" || previous === current)
    return null;
  const recovered =
    CANONICAL_STATUS_PRECEDENCE[current] <
    CANONICAL_STATUS_PRECEDENCE[previous];
  return (
    <span className="ml-2 text-xs text-muted-foreground">
      <span aria-hidden="true">{recovered ? "↑" : "↓"}</span>{" "}
      {recovered ? "Recovered" : "Slipped"}
    </span>
  );
}

export function TrafficLightHistoryTable({
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
      const worst = trafficLightToCanonical(worstTrafficStatus(row.statuses));
      return {
        row,
        rank: Math.max(
          CANONICAL_STATUS_PRECEDENCE["on-track"],
          CANONICAL_STATUS_PRECEDENCE[worst],
        ),
      };
    })
    .toSorted((a, b) => b.rank - a.rank);
  const latestIndex = periods.length - 1;
  const latestCounts = canonicalStatusSchema.options
    .map((status) => ({
      status,
      count: rows.filter(
        (row) => trafficLightToCanonical(row.statuses[latestIndex]) === status,
      ).length,
    }))
    .filter(({ count }) => count > 0);

  return (
    <>
      <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        Week ending {periods[latestIndex]}:
        {latestCounts.map(({ status, count }) => (
          <span
            key={status}
            className="inline-flex items-center gap-1 whitespace-nowrap"
          >
            {count} <SlideStatusBadge status={status} labelVariant="screen" />
          </span>
        ))}
      </p>
      <div
        className="max-w-full overflow-x-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
        tabIndex={0}
        role="region"
        aria-labelledby={headingId}
      >
        <table className="min-w-full border-collapse text-sm">
          <caption className="sr-only">Traffic-light history data</caption>
          <thead>
            <tr className="border-b text-left">
              <th
                scope="col"
                className="sticky left-0 z-20 bg-[var(--color-background)] px-3 py-2"
              >
                Project
              </th>
              {periods.map((period, index) => (
                <th
                  key={period}
                  scope="col"
                  className={`whitespace-nowrap px-3 py-2 ${index === latestIndex ? "bg-[var(--color-surface-muted)]" : ""}`}
                >
                  {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rankedRows.map(({ row }) => (
              <tr key={row.projectId} className="border-b last:border-0">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-[var(--color-background)] px-3 py-2 text-left font-medium"
                >
                  {row.projectName}
                </th>
                {periods.map((period, index) => (
                  <td
                    key={period}
                    className={`whitespace-nowrap px-3 py-2 ${index === latestIndex ? "bg-[var(--color-surface-muted)]" : ""}`}
                  >
                    <SlideStatusBadge
                      status={trafficLightToCanonical(
                        row.statuses[index] ?? null,
                      )}
                      labelVariant="screen"
                    />{" "}
                    {index === latestIndex && index > 0 ? (
                      <StatusChange
                        previous={trafficLightToCanonical(
                          row.statuses[index - 1],
                        )}
                        current={trafficLightToCanonical(row.statuses[index])}
                      />
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
