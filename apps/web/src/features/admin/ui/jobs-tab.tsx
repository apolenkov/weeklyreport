"use client";

import {
  type InfiniteData,
  useInfiniteQuery,
  type UseInfiniteQueryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { type FailedJob, JobsTabView } from "./jobs/jobs-tab-view";

const QUEUE_NAME = "email-reminder" as const;

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

export function JobsTab() {
  const listQuery = useFailedJobsPagination();

  const [search, setSearch] = useState("");
  const rows = useExpandedRows();
  const retry = useRetryFailedJob();

  const filteredJobs = useFilteredJobs(listQuery.jobs, search);

  return (
    <JobsTabView
      {...listQuery}
      filteredJobs={filteredJobs}
      search={search}
      onSearchChange={setSearch}
      expanded={rows.expanded}
      retryingId={retry.retryingId}
      retryPending={retry.isPending}
      onToggleExpand={rows.toggle}
      onRetry={retry.retry}
    />
  );
}
