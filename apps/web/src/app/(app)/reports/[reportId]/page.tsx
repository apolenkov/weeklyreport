'use client';

import { useParams } from 'next/navigation';

import type { AssembledReport, PdfExportJob } from '@customreport/shared';

import { AppShell } from '../../../../components/navigation/app-shell';
import { PublishedReport } from '../../../../components/report/published-report';
import {
  completePdfExportJob,
  persistPdfExportJob,
  readArchiveReport,
  readPdfExportJob,
  readPublishedReport,
  requestPdfExport,
} from '../../../../components/report/report-runtime';
import { defaultViewerSession, readBrowserSession } from '../../../../lib/dev-session';
import { useBrowserState } from '../../../../lib/use-browser-state';

export default function PublishedReportPage() {
  const params = useParams<{ reportId: string }>();
  const [session] = useBrowserState(defaultViewerSession, () => readBrowserSession(defaultViewerSession));
  const [report] = useBrowserState<AssembledReport | null>(null, () => {
    const requestedReportId = params?.reportId;

    if (!requestedReportId) {
      return readPublishedReport();
    }

    return readArchiveReport(requestedReportId)?.report ?? readPublishedReport();
  });
  const [exportJob, setExportJob] = useBrowserState<PdfExportJob | null>(null, readPdfExportJob);

  function handleRequestPdfExport() {
    if (!report) {
      return;
    }

    const queuedJob = persistPdfExportJob(requestPdfExport(report));
    setExportJob(queuedJob);

    window.setTimeout(() => {
      const completedJob = persistPdfExportJob(completePdfExportJob(queuedJob));
      setExportJob(completedJob);
    }, 100);
  }

  return (
    <AppShell
      activeReportId={session.activeReportId}
      currentPath={params?.reportId ? `/reports/${params.reportId}` : session.activeReportId ? `/reports/${session.activeReportId}` : '/reports'}
      role={session.role}
    >
      {session.role === 'lead' ? (
        <p>Access denied. Published reports are available only to head and viewer users.</p>
      ) : report ? (
        <PublishedReport
          exportJob={exportJob}
          onRequestPdfExport={handleRequestPdfExport}
          report={report}
        />
      ) : (
        <p>Published report not found.</p>
      )}
    </AppShell>
  );
}
