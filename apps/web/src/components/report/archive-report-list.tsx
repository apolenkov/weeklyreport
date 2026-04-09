import React from 'react';

import type { ArchiveReportSummary } from '@customreport/shared';

void React;

type ArchiveReportListProps = {
  reports: ArchiveReportSummary[];
};

export function ArchiveReportList({ reports }: ArchiveReportListProps) {
  return (
    <section>
      <h1>Report History</h1>
      <ul>
        {reports.map((report) => (
          <li key={report.reportId}>
            <p>{`${report.periodStart.toISOString()} → ${report.periodEnd.toISOString()}`}</p>
            <p>{`Portfolio status: ${report.portfolioStatus}`}</p>
            <a href={`/reports/${report.reportId}`}>Open report</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
