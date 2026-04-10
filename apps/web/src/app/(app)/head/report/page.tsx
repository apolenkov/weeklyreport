'use client';

import { trpc } from '../../../../lib/trpc';
import { QueryError } from '../../../../components/common/query-error';
import { AppShell } from '../../../../components/navigation/app-shell';
import { AssembledReportReview } from '../../../../components/head/assembled-report-review';

import type { DraftSavePayload } from '@customreport/shared';

export default function HeadReportPage() {
  const reportQuery = trpc.review.assembledReport.useQuery();
  const saveDraftMutation = trpc.reports.saveDraft.useMutation();
  const publishMutation = trpc.review.publish.useMutation();
  const utils = trpc.useUtils();

  if (reportQuery.isLoading) return <p>Loading...</p>;
  if (reportQuery.error) return <QueryError error={reportQuery.error} onRetry={() => reportQuery.refetch()} />;

  const report = reportQuery.data;

  if (!report) return <p>No assembled report available.</p>;

  async function handleUpdateSection(input: DraftSavePayload) {
    await saveDraftMutation.mutateAsync(input);
    await utils.review.assembledReport.invalidate();
    const refreshed = await reportQuery.refetch();

    return refreshed.data ?? report;
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
