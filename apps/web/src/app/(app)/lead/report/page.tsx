'use client';

import { trpc } from '../../../../lib/trpc';
import { QueryError } from '../../../../components/common/query-error';
import { AppShell } from '../../../../components/navigation/app-shell';
import { ReportSectionForm } from '../../../../components/report-section/report-section-form';

import type {
  DraftSavePayload,
  ReportSectionReadModel,
  SubmitSectionPayload,
} from '@customreport/shared';

export default function LeadReportPage() {
  const sectionQuery = trpc.reports.getActive.useQuery();
  const saveDraftMutation = trpc.reports.saveDraft.useMutation({
    onSuccess: () => sectionQuery.refetch(),
  });
  const submitMutation = trpc.reports.submit.useMutation({
    onSuccess: () => sectionQuery.refetch(),
  });

  if (sectionQuery.isLoading) return <p>Loading...</p>;
  if (sectionQuery.error) return <QueryError error={sectionQuery.error} onRetry={() => sectionQuery.refetch()} />;

  const section = sectionQuery.data;

  if (!section) return <p>No active report section found.</p>;

  async function handleSaveDraft(input: DraftSavePayload): Promise<ReportSectionReadModel> {
    return saveDraftMutation.mutateAsync(input);
  }

  async function handleSubmit(input: SubmitSectionPayload): Promise<ReportSectionReadModel> {
    return submitMutation.mutateAsync(input);
  }

  return (
    <AppShell activeReportId={section.reportId} role="lead" currentPath="/lead/report">
      <ReportSectionForm
        initialSection={section}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}
