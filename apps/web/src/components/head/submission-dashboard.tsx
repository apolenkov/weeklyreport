'use client';

import {
  submissionDashboardRowSchema,
  type SubmissionDashboardRow,
} from '@customreport/shared';

import {
  DataTable,
  type Column,
  Badge,
  Progress,
} from '@customreport/ui';

import { formatDateTime } from '../../lib/format-date';

const columns: Column<SubmissionDashboardRow>[] = [
  {
    key: 'leadName',
    header: 'Lead',
    sortable: true,
  },
  {
    key: 'projectNames',
    header: 'Projects',
    cell: (row) => (
      <span className="text-sm text-muted-foreground">
        {row.projectNames.join(', ')}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    cell: (row) =>
      row.status === 'submitted' ? (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          Submitted
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          Draft
        </Badge>
      ),
  },
  {
    key: 'submittedAt',
    header: 'Submitted',
    sortable: true,
    cell: (row) => formatDateTime(row.submittedAt),
  },
];

type SubmissionDashboardProps = {
  rows: SubmissionDashboardRow[];
};

export function SubmissionDashboard({ rows }: SubmissionDashboardProps) {
  const parsedRows = submissionDashboardRowSchema.array().parse(rows);
  const submittedCount = parsedRows.filter(
    (r) => r.status === 'submitted',
  ).length;
  const total = parsedRows.length;
  const percentage = total > 0 ? Math.round((submittedCount / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Progress value={percentage} className="flex-1" />
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {submittedCount} of {total} leads submitted
        </span>
      </div>
      <DataTable
        columns={columns}
        data={parsedRows}
        aria-label="Submission dashboard"
      />
    </div>
  );
}
