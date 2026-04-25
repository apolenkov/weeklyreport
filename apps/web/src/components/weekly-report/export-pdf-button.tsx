'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../lib/trpc-context';

type ExportPdfButtonProps = {
  readonly reportId: string;
  readonly periodStatus: 'open' | 'published' | 'reopened';
};

/**
 * Export PDF button — Phase 23-01.
 *
 * Wires the head-only `pdfExport.request` mutation to start a BullMQ job, then
 * polls `pdfExport.status` every 2 seconds until the worker reports
 * `completed` or `failed`. On completion, opens the static `/pdfs/{jobId}.pdf`
 * artefact in a new tab so the browser triggers the download.
 *
 * The button is disabled until the period is published (matches the API's
 * published-only constraint in `PdfExportService.requestPdfExport`).
 */
export function ExportPdfButton({
  reportId,
  periodStatus,
}: ExportPdfButtonProps) {
  const trpc = useTRPC();
  const [jobId, setJobId] = useState<string | null>(null);
  // One-shot guard: download fires exactly once per completed jobId regardless
  // of how many times tanstack-query re-runs the effect.
  const lastDownloadedJobIdRef = useRef<string | null>(null);

  const requestMut = useMutation(
    trpc.pdfExport.request.mutationOptions({
      onSuccess: (job) => {
        setJobId(job.jobId);
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : 'Failed to start PDF export',
        );
      },
    }),
  );

  const statusQ = useQuery(
    trpc.pdfExport.status.queryOptions(
      { jobId: jobId ?? '' },
      {
        enabled: jobId !== null,
        refetchInterval: (q) => {
          const status = q.state.data?.status;
          return status === 'queued' || status === 'processing' ? 2000 : false;
        },
      },
    ),
  );

  useEffect(() => {
    const data = statusQ.data;
    if (!data || jobId === null) return;

    if (data.status === 'completed' && data.artifactUrl) {
      if (lastDownloadedJobIdRef.current !== data.jobId) {
        lastDownloadedJobIdRef.current = data.jobId;
        window.open(data.artifactUrl, '_blank');
        toast.success('PDF ready');
        setJobId(null);
      }
      return;
    }

    if (data.status === 'failed') {
      toast.error('PDF export failed. Please try again.');
      setJobId(null);
    }
  }, [statusQ.data, jobId]);

  const isPublished = periodStatus === 'published';
  const isGenerating = requestMut.isPending || jobId !== null;
  const disabled = !isPublished || isGenerating;
  const title = !isPublished
    ? 'Publish the report first'
    : isGenerating
      ? 'Generating PDF…'
      : 'Download a PDF copy of this report';
  const label = isGenerating ? 'Generating…' : 'Export PDF';

  function handleExport() {
    if (disabled) return;
    requestMut.mutate({ reportId });
  }

  return (
    <button
      type="button"
      className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={handleExport}
      disabled={disabled}
      title={title}
      aria-busy={isGenerating}
    >
      {label}
    </button>
  );
}
