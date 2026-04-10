'use client';

import { trpc } from '../../../../lib/trpc';
import { QueryError } from '../../../../components/common/query-error';
import { AppShell } from '../../../../components/navigation/app-shell';
import { ArchiveReportList } from '../../../../components/report/archive-report-list';

export default function ReportHistoryPage() {
  const archiveQuery = trpc.archive.list.useQuery();

  if (archiveQuery.isLoading) return <p>Loading...</p>;
  if (archiveQuery.error) return <QueryError error={archiveQuery.error} onRetry={() => archiveQuery.refetch()} />;

  return (
    <AppShell activeReportId={null} role="viewer" currentPath="/reports/history">
      <ArchiveReportList reports={archiveQuery.data ?? []} />
    </AppShell>
  );
}
