'use client';

import { useMemo } from 'react';

import { AppShell } from '../../../../components/navigation/app-shell';
import { ArchiveReportList } from '../../../../components/report/archive-report-list';
import { listArchiveReportSummaries } from '../../../../components/report/report-runtime';
import { defaultViewerSession, readBrowserSession } from '../../../../lib/dev-session';

export default function ReportHistoryPage() {
  const session = useMemo(() => readBrowserSession(defaultViewerSession), []);
  const reports = useMemo(() => listArchiveReportSummaries(), []);

  return (
    <AppShell activeReportId={session.activeReportId} currentPath="/reports/history" role={session.role}>
      <ArchiveReportList reports={reports} />
    </AppShell>
  );
}
