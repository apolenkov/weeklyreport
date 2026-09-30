"use client";

import type { LeadVelocityOutput } from "@customreport/shared";

import {
  AnalyticsTable,
  StickyColumnHeader,
  StickyRowHeader,
} from "./analytics-table";
import {
  buildLeadSubmissionsTableData,
  weekEndingRange,
} from "./analytics-table-data";

export function LeadSubmissionsTable({
  rows,
  headingId,
}: {
  readonly rows: LeadVelocityOutput;
  readonly headingId: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No submissions data in range.
      </p>
    );
  }

  const { data, series } = buildLeadSubmissionsTableData(rows);
  const displayData = data.toReversed();

  return (
    <AnalyticsTable
      headingId={headingId}
      caption="Lead submissions"
      showScrollHint={rows.length > 1}
    >
      <thead>
        <tr className="border-b text-left">
          <StickyColumnHeader>Lead</StickyColumnHeader>
          {displayData.map((point) => (
            <th
              key={String(point.period)}
              scope="col"
              className="whitespace-nowrap px-3 py-2"
            >
              {weekEndingRange(String(point.period))}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {series.map((lead) => (
          <tr key={lead.dataKey} className="border-b last:border-0">
            <StickyRowHeader>{lead.name}</StickyRowHeader>
            {displayData.map((point) => {
              const submitted = Number(point[lead.dataKey] ?? 0) > 0;
              return (
                <td
                  key={String(point.period)}
                  className={`whitespace-nowrap px-3 py-2 ${submitted ? "" : "text-muted-foreground"}`}
                >
                  {submitted ? (
                    <>
                      <span aria-hidden="true">✓</span> Submitted
                    </>
                  ) : (
                    "Missing"
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </AnalyticsTable>
  );
}
