import React from 'react';

import {
  submissionDashboardRowSchema,
  type ReportSectionReadModel,
  type SubmissionDashboardRow,
} from '@customreport/shared';

import { createDemoSection } from '../report-section/demo-section';

void React;

type SubmissionDashboardProps = {
  rows: SubmissionDashboardRow[];
};

const baseSection = createDemoSection();

const baseRows: SubmissionDashboardRow[] = [
  {
    leadId: baseSection.authorId,
    leadName: baseSection.authorName,
    role: 'lead',
    projectNames: baseSection.projects.map((project) => project.projectName),
    status: 'draft',
    submittedAt: null,
  },
  {
    leadId: '00000000-0000-4000-8000-000000000012',
    leadName: 'Lead 2',
    role: 'lead',
    projectNames: ['Project 2'],
    status: 'submitted',
    submittedAt: new Date('2026-04-09T10:00:00.000Z'),
  },
  {
    leadId: '00000000-0000-4000-8000-000000000013',
    leadName: 'Lead 3',
    role: 'lead',
    projectNames: ['Project 3'],
    status: 'draft',
    submittedAt: null,
  },
  {
    leadId: '00000000-0000-4000-8000-000000000014',
    leadName: 'Lead 4',
    role: 'lead',
    projectNames: ['Project 4'],
    status: 'draft',
    submittedAt: null,
  },
  {
    leadId: '00000000-0000-4000-8000-000000000015',
    leadName: 'Lead 5',
    role: 'lead',
    projectNames: ['Project 5'],
    status: 'submitted',
    submittedAt: new Date('2026-04-09T11:30:00.000Z'),
  },
  {
    leadId: '00000000-0000-4000-8000-000000000016',
    leadName: 'Lead 6',
    role: 'lead',
    projectNames: ['Project 6'],
    status: 'draft',
    submittedAt: null,
  },
];

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

export function buildSubmissionDashboardRows(
  activeSection: ReportSectionReadModel | null,
): SubmissionDashboardRow[] {
  const mergedRows = baseRows.map((row) => {
    if (!activeSection || row.leadId !== activeSection.authorId) {
      return row;
    }

    return submissionDashboardRowSchema.parse({
      ...row,
      projectNames: activeSection.projects.map((project) => project.projectName),
      status: activeSection.status,
      submittedAt: activeSection.submittedAt,
    });
  });

  return submissionDashboardRowSchema.array().parse(sortRows(mergedRows));
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
