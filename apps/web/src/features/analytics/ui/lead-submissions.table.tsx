"use client";

import type { LeadVelocityOutput } from "@customreport/shared";

import { formatPeriodRangeWithYear } from "../../../shared/lib/format/format-date";
import {
  AnalyticsTable,
  ColumnHeader,
  DataCell,
  StickyColumnHeader,
  StickyRowHeader,
} from "./analytics-table";
import { buildLeadSubmissionsTableData } from "./analytics-table-data";

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
      dataColumns={displayData.length}
      showScrollHint={rows.length > 1}
    >
      <thead>
        <tr>
          <StickyColumnHeader>Lead</StickyColumnHeader>
          {displayData.map((point) => (
            <ColumnHeader key={point.periodEnd}>
              {formatPeriodRangeWithYear(point.periodStart, point.periodEnd)}
            </ColumnHeader>
          ))}
        </tr>
      </thead>
      <tbody>
        {series.map((lead) => (
          <tr key={lead.dataKey}>
            <StickyRowHeader>{lead.name}</StickyRowHeader>
            {displayData.map((point) => {
              const submitted = Number(point[lead.dataKey] ?? 0) > 0;
              return (
                <DataCell
                  key={point.periodEnd}
                  className={`whitespace-nowrap ${submitted ? "" : "text-muted-foreground"}`}
                >
                  {submitted ? (
                    <>
                      <span aria-hidden="true">✓</span> Submitted
                    </>
                  ) : (
                    "Missing"
                  )}
                </DataCell>
              );
            })}
          </tr>
        ))}
      </tbody>
    </AnalyticsTable>
  );
}
