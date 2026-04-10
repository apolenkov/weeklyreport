'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

import { trpc } from '../../../../lib/trpc';
import { QueryError } from '../../../../components/common/query-error';
import { AppShell } from '../../../../components/navigation/app-shell';
import { PublishedReport } from '../../../../components/report/published-report';

export default function PublishedReportPage() {
  const params = useParams<{ reportId: string }>();
  const reportId = params?.reportId ?? '';

  const reportQuery = trpc.archive.detail.useQuery(
    { reportId },
    { enabled: Boolean(reportId) },
  );
  const pdfRequestMutation = trpc.pdfExport.request.useMutation();
  const [pdfJobId, setPdfJobId] = useState<string | null>(null);
  const pdfStatusQuery = trpc.pdfExport.status.useQuery(
    { jobId: pdfJobId! },
    {
      enabled: Boolean(pdfJobId),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        if (status === 'completed' || status === 'failed') return false;
        return 2000;
      },
    },
  );

  if (reportQuery.isLoading) return <p>Loading...</p>;
  if (reportQuery.error) return <QueryError error={reportQuery.error} onRetry={() => reportQuery.refetch()} />;

  const detail = reportQuery.data;

  if (!detail) return <p>Published report not found.</p>;

  function handleRequestPdfExport() {
    if (!reportId) return;
    pdfRequestMutation.mutate(
      { reportId },
      {
        onSuccess: (job) => {
          setPdfJobId(job.jobId);
        },
      },
    );
  }

  const exportJob = pdfStatusQuery.data ?? pdfRequestMutation.data ?? null;

  return (
    <AppShell
      activeReportId={reportId}
      currentPath={`/reports/${reportId}`}
      role="viewer"
    >
      <PublishedReport
        exportJob={exportJob}
        onRequestPdfExport={handleRequestPdfExport}
        report={detail.report}
      />
    </AppShell>
  );
}
