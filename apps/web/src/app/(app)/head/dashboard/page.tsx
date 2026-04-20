'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock, FileStack, Users } from 'lucide-react';

import { Button, Card, CardContent, CardHeader, CardTitle, Progress } from '@customreport/ui';

import { trpc } from '../../../../lib/trpc';
import { QueryError } from '../../../../components/common/query-error';
import { AppShell } from '../../../../components/navigation/app-shell';
import { SubmissionDashboard } from '../../../../components/head/submission-dashboard';
import {
  PageTitleSkeleton,
  CardSkeleton,
  TableSkeleton,
} from '../../../../components/common/page-skeleton';
import { EmptyState } from '../../../../components/common/empty-state';

export default function HeadDashboardPage() {
  const dashboardQuery = trpc.review.dashboard.useQuery();

  if (dashboardQuery.isLoading) {
    return (
      <AppShell activeReportId={null} role="head" currentPath="/head/dashboard">
        <div className="space-y-8">
          <PageTitleSkeleton />
          <div className="grid gap-4 sm:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <TableSkeleton />
        </div>
      </AppShell>
    );
  }

  if (dashboardQuery.error) {
    return (
      <AppShell activeReportId={null} role="head" currentPath="/head/dashboard">
        <QueryError
          error={dashboardQuery.error}
          onRetry={() => dashboardQuery.refetch()}
        />
      </AppShell>
    );
  }

  const rows = dashboardQuery.data ?? [];
  const submittedCount = rows.filter((r) => r.status === 'submitted').length;
  const total = rows.length;
  const percentage = total > 0 ? Math.round((submittedCount / total) * 100) : 0;
  const draftCount = total - submittedCount;

  if (rows.length === 0) {
    return (
      <AppShell activeReportId={null} role="head" currentPath="/head/dashboard">
        <EmptyState
          icon={Users}
          title="No submissions yet"
          description="No leads have been assigned to the current period. Configure users and periods in the admin panel."
          action={{ label: 'Open Admin', href: '/admin' }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell activeReportId={null} role="head" currentPath="/head/dashboard">
      <div className="animate-fade-in space-y-8">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Review Dashboard</h1>
            <p className="mt-1 text-base text-muted-foreground">
              Track lead submissions and assemble the weekly report
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/head/report">
              <FileStack className="h-5 w-5" />
              Open Assembled Report
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>

        {/* KPI cards */}
        <div className="stagger-children grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-muted-foreground">
                Total Leads
              </CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-muted-foreground">
                Submitted
              </CardTitle>
              <CheckCircle2 className="h-5 w-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-success">{submittedCount}</div>
              <Progress value={percentage} className="mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold text-muted-foreground">
                Awaiting
              </CardTitle>
              <Clock className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold text-warning">{draftCount}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {draftCount === 0 ? 'All leads submitted' : 'Still in draft'}
              </p>

            </CardContent>
          </Card>
        </div>

        {/* Lead submissions */}
        <SubmissionDashboard rows={rows} />
      </div>
    </AppShell>
  );
}
