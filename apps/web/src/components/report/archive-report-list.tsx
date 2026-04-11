'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import type { ArchiveReportSummary } from '@customreport/shared';
import {
  Button,
  DataTable,
  TrafficLightBadge,
} from '@customreport/ui';
import type { Column, TrafficLightStatus } from '@customreport/ui';

type ArchiveReportListProps = {
  readonly reports: ArchiveReportSummary[];
};

function toTrafficLightStatus(value: string): TrafficLightStatus {
  if (value === 'green' || value === 'yellow' || value === 'red') return value;
  return 'unset';
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '\u2014';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('ru-RU', { dateStyle: 'medium' });
}

const columns: Column<ArchiveReportSummary>[] = [
  {
    key: 'periodStart',
    header: 'Period',
    sortable: true,
    cell: (row) => `${formatDate(row.periodStart)} \u2013 ${formatDate(row.periodEnd)}`,
  },
  {
    key: 'portfolioStatus',
    header: 'Portfolio Status',
    sortable: true,
    cell: (row) => (
      <TrafficLightBadge status={toTrafficLightStatus(row.portfolioStatus)} />
    ),
  },
  {
    key: 'publishedAt',
    header: 'Published',
    sortable: true,
    cell: (row) => formatDate(row.publishedAt),
  },
  {
    key: 'reportId',
    header: 'Actions',
    cell: (row) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/reports/${row.reportId}`}>Open</Link>
      </Button>
    ),
  },
];

export function ArchiveReportList({ reports }: ArchiveReportListProps) {
  const router = useRouter();

  return (
    <DataTable
      columns={columns}
      data={reports}
      onRowClick={(row) => router.push(`/reports/${row.reportId}`)}
      aria-label="Report history"
    />
  );
}
