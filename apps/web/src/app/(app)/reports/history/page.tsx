'use client';

import { trpc } from '../../../../lib/trpc';
import { QueryError } from '../../../../components/common/query-error';
import { AppShell } from '../../../../components/navigation/app-shell';
import { ArchiveReportList } from '../../../../components/report/archive-report-list';
import {
  PageTitleSkeleton,
  TableSkeleton,
} from '../../../../components/common/page-skeleton';

export default function ReportHistoryPage() {
  const archiveQuery = trpc.archive.list.useQuery();

  if (archiveQuery.isLoading) {
    return (
      <AppShell activeReportId={null} role="viewer" currentPath="/reports/history">
        <div className="space-y-6">
          <PageTitleSkeleton />
          <TableSkeleton />
        </div>
      </AppShell>
    );
  }

  if (archiveQuery.error) {
    return (
      <AppShell activeReportId={null} role="viewer" currentPath="/reports/history">
        <QueryError
          error={archiveQuery.error}
          onRetry={() => archiveQuery.refetch()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell activeReportId={null} role="viewer" currentPath="/reports/history">
      <div className="animate-fade-in space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Report History
        </h1>
        <ArchiveReportList reports={archiveQuery.data ?? []} />
      </div>
    </AppShell>
  );
}
