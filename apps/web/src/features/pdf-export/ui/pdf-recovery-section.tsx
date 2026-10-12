"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PdfRecoveryJob } from "@weeklyreport/shared";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { formatDateTime } from "../../../shared/lib/format/format-date";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { TabHeader } from "../../../shared/ui/tabs/tab-header";

// DB-backed, not Redis-backed: a quarantined row's queue job may be gone.
function usePdfRecoveryList() {
  const trpc = useTRPC();
  const query = useQuery(trpc.admin.jobs.listPdfRecovery.queryOptions());
  useQueryErrorHandler(query, {
    component: "PdfRecoverySection",
    event: "admin.jobs.list_pdf_recovery",
    procedure: "admin.jobs.listPdfRecovery",
  });
  return query;
}

// The id in flight marks which row shows the spinner; the settle path always
// re-lists so idempotent retries cannot leave a stale row on screen.
function useRetryPdfRecovery() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const retryMut = useMutation(
    trpc.admin.jobs.retryPdfRecovery.mutationOptions({
      onSuccess: (result) => {
        if (result.outcome === "retried") {
          toast.success(
            `Export ${result.jobId} advanced to a fresh generation.`,
          );
        } else if (result.outcome === "already-advanced") {
          toast.info(
            `Export ${result.jobId} already advanced; list refreshed.`,
          );
        } else {
          toast.info(`Export ${result.jobId} is not eligible for retry.`);
        }
      },
      onError: (err) => {
        toast.error(`Recovery retry failed: ${err.message}`);
      },
      onSettled: () => {
        setRetryingId(null);
        void qc
          .invalidateQueries(trpc.admin.jobs.listPdfRecovery.pathFilter())
          .catch(() => undefined);
      },
    }),
  );

  return {
    retryingId,
    isPending: retryMut.isPending,
    retry: (job: PdfRecoveryJob) => {
      setRetryingId(job.jobId);
      retryMut.mutate({
        jobId: job.jobId,
        expectedGeneration: job.generation,
      });
    },
  };
}

function PdfRecoveryLoadingState() {
  return (
    <div
      className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]"
      data-testid="pdf-recovery-loading"
      role="status"
      aria-label="Loading PDF export recovery list"
      aria-live="polite"
    >
      <div className="min-w-[37rem] space-y-4 px-4 py-3">
        {Array.from({ length: 2 }, (_, row) => (
          <div
            key={row}
            className="h-4 w-full animate-pulse rounded bg-[var(--color-border)] motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}

function PdfRecoveryErrorState({ message }: { readonly message: string }) {
  return (
    <div
      role="alert"
      data-testid="pdf-recovery-error"
      className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-[var(--color-status-blocked-bg)] p-4 text-sm text-[var(--color-destructive)]"
    >
      Failed to load recovery list: {message}
    </div>
  );
}

function PdfRecoveryEmptyState() {
  return (
    <div
      data-testid="pdf-recovery-empty"
      className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]"
    >
      No failed exports. Every PDF export has finished.
    </div>
  );
}

const HEAD_CELL_CLASSNAME =
  "px-4 py-3 font-semibold text-[var(--color-foreground)]";

// Both durable terminal states are listed: failed (whose queue job may still
// be retained or already pruned) and quarantined recovery_required rows.
const STATUS_LABELS: Record<PdfRecoveryJob["status"], string> = {
  failed: "Failed",
  recovery_required: "Recovery required",
};

function PdfRecoveryTable({
  jobs,
  retryingId,
  retryPending,
  onRetry,
}: {
  readonly jobs: readonly PdfRecoveryJob[];
  readonly retryingId: string | null;
  readonly retryPending: boolean;
  readonly onRetry: (job: PdfRecoveryJob) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] shadow-[var(--shadow-card-resting)]">
      <table
        className="w-full text-left text-sm"
        data-testid="pdf-recovery-table"
      >
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
            <th className={HEAD_CELL_CLASSNAME}>Job</th>
            <th className={HEAD_CELL_CLASSNAME}>Report</th>
            <th className={HEAD_CELL_CLASSNAME}>Status</th>
            <th className={HEAD_CELL_CLASSNAME}>Generation</th>
            <th className={HEAD_CELL_CLASSNAME}>Requested by</th>
            <th className={HEAD_CELL_CLASSNAME}>Created</th>
            <th className={`${HEAD_CELL_CLASSNAME} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.jobId}
              className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]"
              data-testid={`pdf-recovery-row-${job.jobId}`}
            >
              <td className="px-4 py-3 font-mono text-xs text-[var(--color-foreground)]">
                {job.jobId}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[var(--color-foreground)]">
                {job.reportId}
              </td>
              <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                {STATUS_LABELS[job.status]}
              </td>
              <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                {job.generation}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                {job.requestedBy}
              </td>
              <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                {formatDateTime(job.createdAt)}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onRetry(job)}
                  disabled={retryPending}
                  className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Retry PDF export ${job.jobId}`}
                >
                  {retryingId === job.jobId && retryPending
                    ? "Retrying…"
                    : "Retry"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PdfRecoverySection() {
  const list = usePdfRecoveryList();
  const retry = useRetryPdfRecovery();
  const jobs = list.data?.jobs ?? [];

  return (
    <section
      aria-label="PDF export recovery"
      className="space-y-4"
      data-testid="pdf-recovery-section"
    >
      <TabHeader
        title="Failed exports"
        description="PDF exports that did not finish are listed here. Retry starts a fresh attempt."
        count={list.data ? jobs.length : undefined}
      />
      {list.isLoading ? (
        <PdfRecoveryLoadingState />
      ) : list.isError ? (
        <PdfRecoveryErrorState message={list.error.message} />
      ) : jobs.length === 0 ? (
        <PdfRecoveryEmptyState />
      ) : (
        <PdfRecoveryTable
          jobs={jobs}
          retryingId={retry.retryingId}
          retryPending={retry.isPending}
          onRetry={retry.retry}
        />
      )}
      <p className="text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/reports"
          className="font-semibold text-[var(--color-starbucks-accent)] underline underline-offset-2 hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          Exports are generated from a report
        </Link>
        . Open one and choose Export PDF.
      </p>
    </section>
  );
}
