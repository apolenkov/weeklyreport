'use client';

import { Alert, AlertDescription, AlertTitle } from '@customreport/ui';

import { trpc } from '../../../../lib/trpc';
import { QueryError } from '../../../../components/common/query-error';
import { AppShell } from '../../../../components/navigation/app-shell';
import { ReportSectionForm } from '../../../../components/report-section/report-section-form';
import { PageTitleSkeleton, SectionCardSkeleton } from '../../../../components/common/page-skeleton';

import type {
  DraftSavePayload,
  SubmitSectionPayload,
} from '@customreport/shared';

function LeadReportSkeleton() {
  return (
    <div className="animate-fade-in space-y-6">
      <PageTitleSkeleton />
      <SectionCardSkeleton />
      <SectionCardSkeleton />
      <SectionCardSkeleton />
    </div>
  );
}

export default function LeadReportPage() {
  const sectionQuery = trpc.reports.getActive.useQuery();
  const saveDraftMutation = trpc.reports.saveDraft.useMutation({
    onSuccess: () => sectionQuery.refetch(),
  });
  const submitMutation = trpc.reports.submit.useMutation({
    onSuccess: () => sectionQuery.refetch(),
  });

  if (sectionQuery.isLoading) {
    return (
      <AppShell role="lead" currentPath="/lead/report">
        <LeadReportSkeleton />
      </AppShell>
    );
  }

  if (sectionQuery.error) {
    return (
      <AppShell role="lead" currentPath="/lead/report">
        <QueryError error={sectionQuery.error} onRetry={() => sectionQuery.refetch()} />
      </AppShell>
    );
  }

  const section = sectionQuery.data;

  if (!section) {
    return (
      <AppShell role="lead" currentPath="/lead/report">
        <Alert>
          <AlertTitle>No active report</AlertTitle>
          <AlertDescription>
            There is no active report section for the current period. It will appear here once a new period is created.
          </AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  async function handleSaveDraft(input: DraftSavePayload) {
    return saveDraftMutation.mutateAsync(input);
  }

  async function handleSubmit(input: SubmitSectionPayload) {
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
