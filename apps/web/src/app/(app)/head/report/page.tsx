'use client';

import { Alert, AlertDescription, AlertTitle } from '@customreport/ui';

import { trpc } from '../../../../lib/trpc';
import { QueryError } from '../../../../components/common/query-error';
import { AppShell } from '../../../../components/navigation/app-shell';
import { AssembledReportReview } from '../../../../components/head/assembled-report-review';
import {
  PageTitleSkeleton,
  SectionCardSkeleton,
} from '../../../../components/common/page-skeleton';

import type { DraftSavePayload } from '@customreport/shared';

export default function HeadReportPage() {
  const reportQuery = trpc.review.assembledReport.useQuery();
  const saveDraftMutation = trpc.reports.saveDraft.useMutation();
  const publishMutation = trpc.review.publish.useMutation();
  const utils = trpc.useUtils();

  if (reportQuery.isLoading) {
    return (
      <AppShell activeReportId={null} role="head" currentPath="/head/report">
        <div className="animate-fade-in space-y-6">
          <PageTitleSkeleton />
          <SectionCardSkeleton />
          <SectionCardSkeleton />
          <SectionCardSkeleton />
        </div>
      </AppShell>
    );
  }

  if (reportQuery.error) {
    return (
      <QueryError
        error={reportQuery.error}
        onRetry={() => reportQuery.refetch()}
      />
    );
  }

  const report = reportQuery.data;

  if (!report) {
    return (
      <AppShell activeReportId={null} role="head" currentPath="/head/report">
        <Alert>
          <AlertTitle>No data yet</AlertTitle>
          <AlertDescription>
            No assembled report available. It will appear here once leads begin
            submitting their sections.
          </AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  async function handleUpdateSection(input: DraftSavePayload) {
    await saveDraftMutation.mutateAsync(input);
    await utils.review.assembledReport.invalidate();
    const refreshed = await reportQuery.refetch();

    // Non-null assertion safe: report was checked on line 44, and
    // refetch returns fresh data from the same query.
    return refreshed.data ?? report!;
  }

  async function handlePublish() {
    const result = await publishMutation.mutateAsync();
    await utils.review.assembledReport.invalidate();

    return result;
  }

  return (
    <AppShell activeReportId={null} role="head" currentPath="/head/report">
      <AssembledReportReview
        initialReport={report}
        onPublish={handlePublish}
        onUpdateSection={handleUpdateSection}
      />
    </AppShell>
  );
}
