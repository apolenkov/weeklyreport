"use client";

import {
  EMAIL_REMINDER_QUEUE_NAME,
  type FailedJob,
  QUEUE_NAMES,
  type QueueName,
} from "@customreport/shared";
import {
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import type { TRPCProxy } from "../../../shared/lib/trpc/trpc";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { ConfirmDeleteDialog } from "../../../shared/ui/dialogs/confirm-delete-dialog";
import { JobsTabView } from "./jobs/jobs-tab-view";

const DEFAULT_QUEUE: QueueName = EMAIL_REMINDER_QUEUE_NAME;

interface FailedJobsPagination {
  readonly jobs: readonly FailedJob[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Readonly<{ message: string }> | null;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly fetchNextPage: () => void;
}

// Cursor-paginated over the full failed set: the API defaults to 50 rows per
// page, so a single query would leave every older failure unreachable.
function useFailedJobsPagination(queue: QueueName): FailedJobsPagination {
  const trpc = useTRPC();
  const query = useInfiniteQuery(
    trpc.admin.jobs.listFailed.infiniteQueryOptions(
      { queue },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    ),
  );
  useQueryErrorHandler(query, {
    component: "JobsTab",
    event: "admin.jobs.list_failed",
    procedure: "admin.jobs.listFailed",
    context: { queue },
  });
  const jobs = useMemo(
    () => query.data?.pages.flatMap((page) => page.jobs) ?? [],
    [query.data?.pages],
  );
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

function refreshFailedJobs(
  qc: QueryClient,
  trpc: TRPCProxy,
  queue: QueueName,
): void {
  void Promise.all([
    qc.invalidateQueries(
      trpc.admin.jobs.listFailed.infiniteQueryFilter({ queue }),
    ),
    qc.invalidateQueries(trpc.admin.dlqCount.pathFilter()),
  ]).catch(() => undefined);
}

// Retry of a single failed job plus the id currently in flight, so the row
// that was clicked is the only one showing a spinner.
function useRetryFailedJob(queue: QueueName) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const retryMut = useMutation(
    trpc.admin.jobs.retryFailed.mutationOptions({
      onSuccess: (result, variables) => {
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
        refreshFailedJobs(qc, trpc, variables.queue);
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
      retryMut.mutate({ queue, jobId });
    },
  };
}

function useRemoveFailedJob(onSuccess: () => void) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const removeMut = useMutation(
    trpc.admin.jobs.removeFailed.mutationOptions({
      onSuccess: (result, variables) => {
        if (result.removed) {
          toast.success(`Job ${result.jobId} removed from failed jobs.`);
        } else {
          toast.info(`Job ${result.jobId} no longer exists; list refreshed.`);
        }
        refreshFailedJobs(qc, trpc, variables.queue);
        setRemovingId(null);
        onSuccess();
      },
      onError: (err) => {
        toast.error(`Remove failed: ${err.message}`);
        setRemovingId(null);
      },
    }),
  );

  return {
    removingId,
    isPending: removeMut.isPending,
    remove: (queue: QueueName, jobId: string) => {
      setRemovingId(jobId);
      removeMut.mutate({ queue, jobId });
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
    clear: () => setExpanded(new Set()),
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

// Opens on the first queue that has failed jobs (the tab badge counts every
// queue). Chosen once so a later count refresh never moves the list under the
// admin, e.g. after removing the last failure of the opened queue.
function useSelectedQueue() {
  const trpc = useTRPC();
  const countQuery = useQuery(trpc.admin.dlqCount.queryOptions());
  const [chosen, setChosen] = useState<QueueName | null>(null);
  if (chosen === null && countQuery.data) {
    setChosen(
      countQuery.data.byQueue.find((entry) => entry.count > 0)?.queue ??
        DEFAULT_QUEUE,
    );
  }
  return [chosen ?? DEFAULT_QUEUE, setChosen] as const;
}

export function JobsTab() {
  const [queue, setQueue] = useSelectedQueue();
  const [pendingRemoval, setPendingRemoval] = useState<{
    readonly queue: QueueName;
    readonly jobId: string;
  } | null>(null);
  const listQuery = useFailedJobsPagination(queue);

  const [search, setSearch] = useState("");
  const rows = useExpandedRows();
  const retry = useRetryFailedJob(queue);
  const remove = useRemoveFailedJob(() => setPendingRemoval(null));

  const filteredJobs = useFilteredJobs(listQuery.jobs, search);

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-semibold">
        Queue
        <select
          name="queue"
          autoComplete="off"
          value={queue}
          onChange={(event) => {
            setQueue(event.target.value as QueueName);
            rows.clear();
          }}
          aria-label="Failed job queue"
          className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 font-normal"
        >
          {QUEUE_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <JobsTabView
        {...listQuery}
        queue={queue}
        filteredJobs={filteredJobs}
        search={search}
        onSearchChange={setSearch}
        expanded={rows.expanded}
        retryingId={retry.retryingId}
        retryPending={retry.isPending}
        removingId={remove.removingId}
        removePending={remove.isPending}
        onToggleExpand={rows.toggle}
        onRetry={retry.retry}
        onRemove={(jobId) => setPendingRemoval({ queue, jobId })}
      />
      <ConfirmDeleteDialog
        open={pendingRemoval !== null}
        title="Remove failed job?"
        preview={pendingRemoval?.jobId ?? ""}
        consequence="This permanently removes the failed job from the queue."
        confirmLabel="Remove"
        reversible={false}
        isPending={remove.isPending}
        onConfirm={() => {
          if (pendingRemoval) {
            remove.remove(pendingRemoval.queue, pendingRemoval.jobId);
          }
        }}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  );
}
