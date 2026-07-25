"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ComponentProps, useMemo, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import { TabHeader, TabSearch } from "../../../shared/ui/tab-header";
import { JobsSkeleton } from "./jobs-skeleton";
import { JobsTableRow } from "./jobs-table-row";

const QUEUE_NAME = "email-reminder" as const;

type FailedJob = ComponentProps<typeof JobsTableRow>["job"];

// Retry of a single failed job plus the id currently in flight, so the row
// that was clicked is the only one showing a spinner.
function useRetryFailedJob() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);

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

  return {
    retryingId,
    isPending: retryMut.isPending,
    retry: (jobId: string) => {
      setRetryingId(jobId);
      retryMut.mutate({ queue: QUEUE_NAME, jobId });
    },
  };
}

function useExpandedRows() {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  return {
    expanded,
    toggle: (jobId: string) => {
      setExpanded((prev) =>
        prev.has(jobId)
          ? new Set([...prev].filter((id) => id !== jobId))
          : new Set([...prev, jobId]),
      );
    },
  };
}

function useFilteredJobs(jobs: readonly FailedJob[], search: string) {
  return useMemo(() => {
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
}

function JobsErrorState({ message }: { readonly message: string }) {
  return (
    <div
      role="alert"
      data-testid="jobs-error-state"
      className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-red-50 p-4 text-sm text-red-800"
    >
      Failed to load list: {message}
    </div>
  );
}

function JobsEmptyState({ queueIsClean }: { readonly queueIsClean: boolean }) {
  return (
    <div
      data-testid="jobs-empty-state"
      className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]"
    >
      {queueIsClean
        ? "No failed email reminder jobs. Queue is clean."
        : "No failed jobs match the search."}
    </div>
  );
}

const HEAD_CELL_CLASSNAME =
  "px-4 py-3 font-semibold text-[var(--color-foreground)]";

function JobsTable({
  jobs,
  expanded,
  retryingId,
  retryPending,
  onToggleExpand,
  onRetry,
}: {
  readonly jobs: readonly FailedJob[];
  readonly expanded: ReadonlySet<string>;
  readonly retryingId: string | null;
  readonly retryPending: boolean;
  readonly onToggleExpand: (jobId: string) => void;
  readonly onRetry: (jobId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <table className="w-full text-left text-sm" data-testid="jobs-table">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
            <th className={HEAD_CELL_CLASSNAME}>ID</th>
            <th className={HEAD_CELL_CLASSNAME}>Name</th>
            <th className={HEAD_CELL_CLASSNAME}>Attempts</th>
            <th className={HEAD_CELL_CLASSNAME}>Error</th>
            <th className={HEAD_CELL_CLASSNAME}>Time</th>
            <th className={`${HEAD_CELL_CLASSNAME} text-right`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <JobsTableRow
              key={job.id}
              job={job}
              isExpanded={expanded.has(job.id)}
              isRetrying={retryingId === job.id && retryPending}
              retryDisabled={retryPending}
              onToggleExpand={onToggleExpand}
              onRetry={onRetry}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Jobs Tab.
 */
export function JobsTab() {
  const trpc = useTRPC();

  const listQuery = useQuery(
    trpc.admin.jobs.listFailed.queryOptions({ queue: QUEUE_NAME }),
  );

  const [search, setSearch] = useState("");
  const rows = useExpandedRows();
  const retry = useRetryFailedJob();

  const jobs = useMemo(() => listQuery.data?.jobs ?? [], [listQuery.data]);
  const filteredJobs = useFilteredJobs(jobs, search);

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
        <JobsErrorState message={listQuery.error.message} />
      )}

      {!listQuery.isPending &&
        !listQuery.isError &&
        filteredJobs.length === 0 && (
          <JobsEmptyState queueIsClean={jobs.length === 0} />
        )}

      {filteredJobs.length > 0 && (
        <JobsTable
          jobs={filteredJobs}
          expanded={rows.expanded}
          retryingId={retry.retryingId}
          retryPending={retry.isPending}
          onToggleExpand={rows.toggle}
          onRetry={retry.retry}
        />
      )}
    </div>
  );
}
