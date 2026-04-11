'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@customreport/ui';

import { trpc } from '../../../../lib/trpc';
import { QueryError } from '../../../../components/common/query-error';
import { AppShell } from '../../../../components/navigation/app-shell';
import { PublishedReport } from '../../../../components/report/published-report';
import {
  CardSkeleton,
  PageTitleSkeleton,
} from '../../../../components/common/page-skeleton';

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

  if (reportQuery.isLoading) {
    return (
      <AppShell
        activeReportId={reportId}
        currentPath={`/reports/${reportId}`}
        role="viewer"
      >
        <div className="space-y-6">
          <PageTitleSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </AppShell>
    );
  }

  if (reportQuery.error) {
    return (
      <AppShell
        activeReportId={reportId}
        currentPath={`/reports/${reportId}`}
        role="viewer"
      >
        <QueryError
          error={reportQuery.error}
          onRetry={() => reportQuery.refetch()}
        />
      </AppShell>
    );
  }

  const detail = reportQuery.data;

  if (!detail) {
    return (
      <AppShell
        activeReportId={reportId}
        currentPath={`/reports/${reportId}`}
        role="viewer"
      >
        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-[480px]">
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Published report not found</AlertTitle>
              <AlertDescription>
                <p>
                  The requested report does not exist or has not been published
                  yet.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </AppShell>
    );
  }

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
