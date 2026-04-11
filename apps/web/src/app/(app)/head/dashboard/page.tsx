'use client';

import Link from 'next/link';

import { Button } from '@customreport/ui';

import { trpc } from '../../../../lib/trpc';
import { QueryError } from '../../../../components/common/query-error';
import { AppShell } from '../../../../components/navigation/app-shell';
import { SubmissionDashboard } from '../../../../components/head/submission-dashboard';
import {
  PageTitleSkeleton,
  TableSkeleton,
} from '../../../../components/common/page-skeleton';

export default function HeadDashboardPage() {
  const dashboardQuery = trpc.review.dashboard.useQuery();

  if (dashboardQuery.isLoading) {
    return (
      <AppShell activeReportId={null} role="head" currentPath="/head/dashboard">
        <div className="space-y-6">
          <PageTitleSkeleton />
          <TableSkeleton />
        </div>
      </AppShell>
    );
  }

  if (dashboardQuery.error) {
    return (
      <QueryError
        error={dashboardQuery.error}
        onRetry={() => dashboardQuery.refetch()}
      />
    );
  }

  return (
    <AppShell activeReportId={null} role="head" currentPath="/head/dashboard">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[28px] font-semibold leading-[1.2]">
          Review Dashboard
        </h1>
        <Button variant="outline" asChild>
          <Link href="/head/report">Open assembled report</Link>
        </Button>
      </div>
      <SubmissionDashboard rows={dashboardQuery.data ?? []} />
    </AppShell>
  );
}
