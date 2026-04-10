import React from 'react';

import {
  submissionDashboardRowSchema,
  type SubmissionDashboardRow,
} from '@customreport/shared';

void React;

type SubmissionDashboardProps = {
  rows: SubmissionDashboardRow[];
};

const statusOrder: Record<SubmissionDashboardRow['status'], number> = {
  draft: 0,
  submitted: 1,
};

function sortRows(rows: SubmissionDashboardRow[]): SubmissionDashboardRow[] {
  return [...rows].sort((left, right) => {
    const statusDiff = statusOrder[left.status] - statusOrder[right.status];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    return left.leadName.localeCompare(right.leadName, 'ru');
  });
}

function formatSubmittedAt(submittedAt: Date | null): string {
  if (!submittedAt) {
    return '—';
  }

  return submittedAt.toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function SubmissionDashboard({ rows }: SubmissionDashboardProps) {
  const sortedRows = sortRows(submissionDashboardRowSchema.array().parse(rows));

  return (
    <table aria-label="Submission dashboard">
      <thead>
        <tr>
          <th scope="col">Lead</th>
          <th scope="col">Projects</th>
          <th scope="col">Status</th>
          <th scope="col">Submitted</th>
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row) => (
          <tr key={row.leadId} data-status={row.status}>
            <td>{row.leadName}</td>
            <td>{row.projectNames.join(', ')}</td>
            <td>{row.status}</td>
            <td>{formatSubmittedAt(row.submittedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
