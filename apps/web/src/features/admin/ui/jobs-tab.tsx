"use client";

import {
  type InfiniteData,
  useInfiniteQuery,
  type UseInfiniteQueryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { type ComponentProps, useMemo, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../lib/trpc-context";
import { TabHeader, TabSearch } from "../../../shared/ui/tab-header";
import { JobsSkeleton } from "./jobs-skeleton";
import { JobsTableRow } from "./jobs-table-row";

const QUEUE_NAME = "email-reminder" as const;

type FailedJob = ComponentProps<typeof JobsTableRow>["job"];
interface FailedJobsPage {
  readonly jobs: readonly FailedJob[];
  readonly nextCursor: number | null;
}

interface FailedJobsPagination {
  readonly jobs: readonly FailedJob[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly fetchNextPage: () => void;
}

// Cursor-paginated over the full failed set: the API defaults to 50 rows per
// page, so a single query would leave every older failure unreachable.
function useFailedJobsPagination(): FailedJobsPagination {
  const trpc = useTRPC();
  // The tRPC branded options are not directly assignable to useInfiniteQuery
  // under exactOptionalPropertyTypes (initialData optionality); widen through
  // the same seam use-cursor-pagination uses.
  const query = useInfiniteQuery(
    trpc.admin.jobs.listFailed.infiniteQueryOptions(
      { queue: QUEUE_NAME },
      {
        getNextPageParam: (lastPage: FailedJobsPage) => lastPage.nextCursor,
      },
    ) as unknown as UseInfiniteQueryOptions<
      FailedJobsPage,
      Error,
      InfiniteData<FailedJobsPage, number | null>,
      readonly unknown[],
      number | null
    >,
  );
  const jobs = useMemo(() => {
    if (query.status !== "success") return [];
    return query.data.pages.flatMap((page) => page.jobs);
  }, [query.data, query.status]);
  return {
    jobs,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
  };
}

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
        void qc
          .invalidateQueries({
            queryKey: trpc.admin.jobs.listFailed.queryKey(),
          })
          .catch(() => undefined);
        // Also nudge the Jobs tab count so it tracks the new failed-jobs
        // total without waiting for its 30s poll.
        void qc
          .invalidateQueries({
            queryKey: trpc.admin.dlqCount.queryKey(),
          })
          .catch(() => undefined);
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
      [job.id, job.name, job.failedReason, String(job.attemptsMade)]
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
      className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-[var(--color-status-blocked-bg)] p-4 text-sm text-[var(--color-destructive)]"
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
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] shadow-[var(--shadow-card-resting)]">
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

export function JobsTab() {
  const listQuery = useFailedJobsPagination();

  const [search, setSearch] = useState("");
  const rows = useExpandedRows();
  const retry = useRetryFailedJob();

  const filteredJobs = useFilteredJobs(listQuery.jobs, search);

  return (
    <div className="space-y-4" data-testid="jobs-tab">
      <TabHeader
        title="Failed Jobs"
        description="Failed email reminder deliveries after all retries. Rules are configured in Reminders; this tab is only for delivery failures."
        count={
          listQuery.isLoading
            ? "Loading…"
            : `${listQuery.jobs.length} loaded${
                listQuery.hasNextPage ? "+" : ""
              }`
        }
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

      {listQuery.isLoading && <JobsSkeleton />}

      {listQuery.isError && (
        <JobsErrorState message={listQuery.error?.message ?? "Unknown error"} />
      )}

      {!listQuery.isLoading &&
        !listQuery.isError &&
        filteredJobs.length === 0 && (
          <JobsEmptyState queueIsClean={listQuery.jobs.length === 0} />
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

      {listQuery.hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={listQuery.fetchNextPage}
            disabled={listQuery.isFetchingNextPage}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
          >
            {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
