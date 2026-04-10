'use client';

import type { ArchiveReportSummary } from '@customreport/shared';

import { AppShell } from '../../../../components/navigation/app-shell';
import { ArchiveReportList } from '../../../../components/report/archive-report-list';
import { listArchiveReportSummaries } from '../../../../components/report/report-runtime';
import { defaultViewerSession, readBrowserSession } from '../../../../lib/dev-session';
import { useBrowserState } from '../../../../lib/use-browser-state';

export default function ReportHistoryPage() {
  const [session] = useBrowserState(defaultViewerSession, () => readBrowserSession(defaultViewerSession));
  const [reports] = useBrowserState<ArchiveReportSummary[]>([], listArchiveReportSummaries);

  return (
    <AppShell activeReportId={session.activeReportId} currentPath="/reports/history" role={session.role}>
      <ArchiveReportList reports={reports} />
    </AppShell>
  );
}
