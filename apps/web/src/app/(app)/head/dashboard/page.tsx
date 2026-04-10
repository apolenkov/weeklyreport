'use client';

import { trpc } from '../../../../lib/trpc';
import { QueryError } from '../../../../components/common/query-error';
import { AppShell } from '../../../../components/navigation/app-shell';
import { SubmissionDashboard } from '../../../../components/head/submission-dashboard';

export default function HeadDashboardPage() {
  const dashboardQuery = trpc.review.dashboard.useQuery();

  if (dashboardQuery.isLoading) return <p>Loading...</p>;
  if (dashboardQuery.error) return <QueryError error={dashboardQuery.error} onRetry={() => dashboardQuery.refetch()} />;

  return (
    <AppShell activeReportId={null} role="head" currentPath="/head/dashboard">
      <section>
        <h1>Review Dashboard</h1>
        <a href="/head/report">Open assembled report</a>
        <SubmissionDashboard rows={dashboardQuery.data} />
      </section>
    </AppShell>
  );
}
