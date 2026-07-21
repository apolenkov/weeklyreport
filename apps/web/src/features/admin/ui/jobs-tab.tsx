"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import { TabHeader, TabSearch } from "../../../shared/ui/tab-header";
import { JobsSkeleton } from "./jobs-skeleton";
import { JobsTableRow } from "./jobs-table-row";

/**
 * BullMQ DLQ admin tab.
 *
 * Surfaces the email-reminder queue's failed-jobs set with a per-row Retry
 * button, styled to match the rest of the admin tabs (row spacing / pill
 * button / tealA accent).
 *
 * Data source: tRPC `admin.jobs.listFailed` (headProcedure). Retry uses
 * `admin.jobs.retryFailed` and invalidates the list query on success so the
 * row falls off without a page refresh.
 */

const QUEUE_NAME = "email-reminder" as const;

export function JobsTab() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const listQuery = useQuery(
    trpc.admin.jobs.listFailed.queryOptions({ queue: QUEUE_NAME }),
  );

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const retryMut = useMutation(
    trpc.admin.jobs.retryFailed.mutationOptions({
      onSuccess: (result) => {
        if (result.removed) {
          toast.info(
            result.reason ?? `Job ${result.jobId} removed from failed jobs.`,
          );
        } else if (result.retried) {
          toast.success(`Job ${result.jobId} queued for retry.`);
        } else {
          // The job no longer exists (e.g. pruned by removeOnFail or already
          // retried elsewhere). Surface as a soft warning, not an error.
          toast.info(`Job ${result.jobId} no longer exists; list refreshed.`);
        }
        void qc.invalidateQueries({
          queryKey: trpc.admin.jobs.listFailed.queryKey(),
        });
        // Also nudge the Jobs tab count so it tracks the new failed-jobs
        // total without waiting for its 30s poll.
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
  const filteredJobs = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return jobs;
    return jobs.filter((job) =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- BullMQ Job field is an external-lib boundary value
      [job.id, job.name, job.failedReason ?? "", String(job.attemptsMade)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [jobs, search]);

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
      <TabHeader
        title="Failed Jobs"
        description="Failed email reminder deliveries after all retries. Rules are configured in Reminders; this tab is only for delivery failures."
        count={`${jobs.length} failed`}
        search={
          <TabSearch
            value={search}
            onChange={setSearch}
            placeholder="Search failed jobs…"
            testId="jobs-search"
            ariaLabel="Search failed jobs"
          />
        }
      />

      {listQuery.isPending && <JobsSkeleton />}

      {listQuery.isError && (
        <div
          role="alert"
          data-testid="jobs-error-state"
          className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-red-50 p-4 text-sm text-red-800"
        >
          Failed to load list: {listQuery.error.message}
        </div>
      )}

      {!listQuery.isPending &&
        !listQuery.isError &&
        filteredJobs.length === 0 && (
          <div
            data-testid="jobs-empty-state"
            className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]"
          >
            {jobs.length === 0
              ? "No failed email reminder jobs. Queue is clean."
              : "No failed jobs match the search."}
          </div>
        )}

      {filteredJobs.length > 0 && (
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
              {filteredJobs.map((job) => (
                <JobsTableRow
                  key={job.id}
                  job={job}
                  isExpanded={expanded.has(job.id)}
                  isRetrying={retryingId === job.id && retryMut.isPending}
                  retryDisabled={retryMut.isPending}
                  onToggleExpand={toggleExpanded}
                  onRetry={handleRetry}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
