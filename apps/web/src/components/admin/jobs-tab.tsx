"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useTRPC } from "../../lib/trpc-context";

/**
 * Phase 35-06: BullMQ DLQ admin tab.
 *
 * Surfaces the email-reminder queue's failed-jobs set with a per-row Retry
 * button. Replaces the only prior in-app DLQ entry point — the raw
 * `/admin/queues` Bull Board mount — with a UI that matches the rest of the
 * admin tabs (matching row spacing / pill button / tealA accent).
 *
 * Data source: tRPC `admin.jobs.listFailed` (headProcedure). Retry uses
 * `admin.jobs.retryFailed` and invalidates the list query on success so the
 * row falls off without a page refresh.
 */

const QUEUE_NAME = "email-reminder" as const;

function formatTimestamp(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

export function JobsTab() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const listQuery = useQuery(
    trpc.admin.jobs.listFailed.queryOptions({ queue: QUEUE_NAME }),
  );

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const retryMut = useMutation(
    trpc.admin.jobs.retryFailed.mutationOptions({
      onSuccess: (result) => {
        if (result.retried) {
          toast.success(`Job ${result.jobId} queued for retry.`);
        } else {
          // The job no longer exists (e.g. pruned by removeOnFail or already
          // retried elsewhere). Surface as a soft warning, not an error.
          toast.info(`Job ${result.jobId} no longer exists; list refreshed.`);
        }
        void qc.invalidateQueries({
          queryKey: trpc.admin.jobs.listFailed.queryKey(),
        });
        // Also nudge the DLQ count badge in the admin shell so it tracks
        // the new failed-jobs total without waiting for its 30s poll.
        void qc.invalidateQueries({
          queryKey: trpc.admin.dlqCount.queryKey(),
        });
        setRetryingId(null);
      },
      onError: (err) => {
        toast.error(`Retry failed: ${err.message}`);
        setRetryingId(null);
      },
    }),
  );

  const jobs = useMemo(() => listQuery.data?.jobs ?? [], [listQuery.data]);

  function handleRetry(jobId: string) {
    setRetryingId(jobId);
    retryMut.mutate({ queue: QUEUE_NAME, jobId });
  }

  function toggleExpanded(jobId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  return (
    <div className="space-y-4" data-testid="jobs-tab">
      <div>
        <h2 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          email-reminder queue
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
          Jobs that exhausted their retry limit. Click Retry to put a job back
          into the queue.
        </p>
      </div>

      {listQuery.isPending && <JobsSkeleton />}

      {listQuery.isError && (
        <div
          role="alert"
          data-testid="jobs-error-state"
          className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-red-50 p-4 text-sm text-red-800"
        >
          Failed to load list: {String(listQuery.error?.message ?? "unknown")}
        </div>
      )}

      {!listQuery.isPending && !listQuery.isError && jobs.length === 0 && (
        <div
          data-testid="jobs-empty-state"
          className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[#fafaf7] p-8 text-center text-sm text-[var(--color-muted-foreground)]"
        >
          No failed jobs; queue is clean.
        </div>
      )}

      {jobs.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <table className="w-full text-left text-sm" data-testid="jobs-table">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  ID
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Name
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Attempts
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Error
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Time
                </th>
                <th className="px-4 py-3 text-right font-semibold text-[var(--color-foreground)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const isExpanded = expanded.has(job.id);
                const isRetrying = retryingId === job.id && retryMut.isPending;
                const reason = job.failedReason || "—";
                const truncated = truncate(reason, 80);
                const canExpand = reason !== truncated;
                return (
                  <tr
                    key={job.id}
                    className="border-b border-[var(--color-border)] last:border-0 hover:bg-[#f8f6f2]"
                    data-testid={`jobs-row-${job.id}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-foreground)]">
                      {job.id}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-foreground)]">
                      {job.name}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                      {job.attemptsMade}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-foreground)]">
                      <div
                        className={
                          isExpanded
                            ? "whitespace-pre-wrap break-words text-xs"
                            : "truncate text-xs"
                        }
                      >
                        {isExpanded ? reason : truncated}
                      </div>
                      {canExpand && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(job.id)}
                          className="mt-1 text-[11px] font-semibold text-[var(--color-starbucks-accent)] hover:underline"
                          aria-expanded={isExpanded}
                          aria-label={
                            isExpanded
                              ? `Collapse job ${job.id} error`
                              : `Expand job ${job.id} error`
                          }
                        >
                          {isExpanded ? "Collapse" : "Expand"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                      {formatTimestamp(job.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleRetry(job.id)}
                        disabled={isRetrying || retryMut.isPending}
                        className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 text-xs font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Retry job ${job.id}`}
                      >
                        {isRetrying ? "Retrying..." : "Retry"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function JobsSkeleton() {
  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--color-border)]"
      data-testid="jobs-loading-state"
      aria-label="Loading failed jobs"
      aria-live="polite"
    >
      <div className="grid grid-cols-6 gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3">
        {[0, 1, 2, 3, 4, 5].map((col) => (
          <div
            key={col}
            className="h-4 w-20 animate-pulse rounded bg-[var(--color-border)]"
          />
        ))}
      </div>
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="grid grid-cols-6 gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-0"
        >
          {[0, 1, 2, 3, 4, 5].map((col) => (
            <div
              key={col}
              className="h-4 w-full animate-pulse rounded bg-[var(--color-border)]"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
