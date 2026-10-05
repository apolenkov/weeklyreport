import {
  AI_PROVIDER_TEST_QUEUE_NAME,
  EMAIL_REMINDER_QUEUE_NAME,
  type FailedJob,
  PDF_EXPORT_QUEUE_NAME,
  type QueueName,
  SEMANTIC_INDEX_QUEUE_NAME,
} from "@customreport/shared";

import { TabHeader, TabSearch } from "../../../../shared/ui/tabs/tab-header";
import { JobsSkeleton } from "../jobs-skeleton";
import { JobsTableRow } from "../jobs-table-row";

interface JobsTabViewProps {
  readonly queue: QueueName;
  readonly jobs: readonly FailedJob[];
  readonly filteredJobs: readonly FailedJob[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Readonly<{ message: string }> | null;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly fetchNextPage: () => void;
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly expanded: ReadonlySet<string>;
  readonly retryingId: string | null;
  readonly retryPending: boolean;
  readonly removingId: string | null;
  readonly removePending: boolean;
  readonly onToggleExpand: (jobId: string) => void;
  readonly onRetry: (jobId: string) => void;
  readonly onRemove: (jobId: string) => void;
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

const QUEUE_COPY = {
  [EMAIL_REMINDER_QUEUE_NAME]: {
    description:
      "Failed email reminder deliveries after all retries. Rules are configured in Reminders; this tab is only for delivery failures.",
    empty: "No failed email reminder jobs. Queue is clean.",
  },
  [PDF_EXPORT_QUEUE_NAME]: {
    description: "Failed PDF export jobs after all retries.",
    empty: "No failed PDF export jobs. Queue is clean.",
  },
  [AI_PROVIDER_TEST_QUEUE_NAME]: {
    description: "Failed AI provider test jobs after all retries.",
    empty: "No failed AI provider test jobs. Queue is clean.",
  },
  [SEMANTIC_INDEX_QUEUE_NAME]: {
    description: "Failed semantic indexing jobs after all retries.",
    empty: "No failed semantic indexing jobs. Queue is clean.",
  },
} satisfies Record<QueueName, { description: string; empty: string }>;

function JobsEmptyState({
  queue,
  queueIsClean,
}: {
  readonly queue: QueueName;
  readonly queueIsClean: boolean;
}) {
  return (
    <div
      data-testid="jobs-empty-state"
      className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]"
    >
      {queueIsClean
        ? QUEUE_COPY[queue].empty
        : "No failed jobs match the search."}
    </div>
  );
}

function JobsListState({
  isLoading,
  isError,
  error,
  jobs,
  filteredJobs,
  queue,
}: Pick<
  JobsTabViewProps,
  "isLoading" | "isError" | "error" | "jobs" | "filteredJobs" | "queue"
>) {
  if (isLoading) return <JobsSkeleton />;
  if (isError) {
    return <JobsErrorState message={error?.message ?? "Unknown error"} />;
  }
  if (filteredJobs.length === 0) {
    return <JobsEmptyState queue={queue} queueIsClean={jobs.length === 0} />;
  }
  return null;
}

const HEAD_CELL_CLASSNAME =
  "px-4 py-3 font-semibold text-[var(--color-foreground)]";

function JobsTable({
  jobs,
  expanded,
  retryingId,
  retryPending,
  removingId,
  removePending,
  onToggleExpand,
  onRetry,
  onRemove,
}: Pick<
  JobsTabViewProps,
  | "jobs"
  | "expanded"
  | "retryingId"
  | "retryPending"
  | "removingId"
  | "removePending"
  | "onToggleExpand"
  | "onRetry"
  | "onRemove"
>) {
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
              retryDisabled={retryPending || removePending}
              onToggleExpand={onToggleExpand}
              onRetry={onRetry}
              onRemove={onRemove}
              isRemoving={removingId === job.id && removePending}
              removeDisabled={removePending || retryPending}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobsLoadMore({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: Pick<
  JobsTabViewProps,
  "hasNextPage" | "isFetchingNextPage" | "fetchNextPage"
>) {
  if (!hasNextPage) return null;
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={fetchNextPage}
        disabled={isFetchingNextPage}
        className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
      >
        {isFetchingNextPage ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}

function loadedCount(jobs: readonly FailedJob[], hasNextPage: boolean): string {
  return `${jobs.length} loaded${hasNextPage ? "+" : ""}`;
}

export function JobsTabView(props: JobsTabViewProps) {
  return (
    <div className="space-y-4" data-testid="jobs-tab">
      <TabHeader
        title="Failed Jobs"
        description={QUEUE_COPY[props.queue].description}
        count={
          props.isLoading
            ? "Loading…"
            : loadedCount(props.jobs, props.hasNextPage)
        }
        search={
          <TabSearch
            value={props.search}
            onChange={props.onSearchChange}
            placeholder="Search failed jobs…"
            testId="jobs-search"
            ariaLabel="Search failed jobs"
            // R54: nothing to search in an empty queue.
            disabled={
              !props.isLoading &&
              !props.isError &&
              props.jobs.length === 0 &&
              props.search === ""
            }
          />
        }
      />
      <JobsListState {...props} />
      {props.filteredJobs.length > 0 && (
        <JobsTable {...props} jobs={props.filteredJobs} />
      )}
      <JobsLoadMore {...props} />
    </div>
  );
}
