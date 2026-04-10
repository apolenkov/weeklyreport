'use client';

import { AppShell } from '../../../../components/navigation/app-shell';
import { readStoredLeadSection } from '../../../../components/report-section/section-storage';
import {
  buildSubmissionDashboardRows,
  SubmissionDashboard,
} from '../../../../components/head/submission-dashboard';
import { defaultLeadSession, readBrowserSession } from '../../../../lib/dev-session';
import { useBrowserState } from '../../../../lib/use-browser-state';

export default function HeadDashboardPage() {
  const [session] = useBrowserState(defaultLeadSession, () => readBrowserSession(defaultLeadSession));
  const [rows] = useBrowserState(
    buildSubmissionDashboardRows(null),
    () => buildSubmissionDashboardRows(readStoredLeadSection()),
  );

  return (
    <AppShell activeReportId={session.activeReportId} role={session.role} currentPath="/head/dashboard">
      <section>
        <h1>Review Dashboard</h1>
        {session.role !== 'head' ? (
          <p>Access denied. This dashboard is available only to head users.</p>
        ) : (
          <>
            <a href="/head/report">Open assembled report</a>
            <SubmissionDashboard rows={rows} />
          </>
        )}
      </section>
    </AppShell>
  );
}
