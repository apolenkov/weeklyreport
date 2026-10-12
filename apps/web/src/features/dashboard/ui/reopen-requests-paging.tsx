"use client";

import { useCallback } from "react";

interface ReopenRequestsListQuery {
  readonly error: unknown;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isFetchNextPageError: boolean;
  readonly isFetchingNextPage: boolean;
  readonly hasNextPage: boolean;
  readonly fetchNextPage: (options: { cancelRefetch: boolean }) => unknown;
  readonly refetch: (options: { cancelRefetch: boolean }) => unknown;
}

export function ReopenRequestsLoading() {
  return (
    <section
      className="min-h-28 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-4"
      role="status"
      aria-busy="true"
      aria-label="Loading pending reopen requests"
    >
      <div className="h-5 w-40 animate-pulse motion-reduce:animate-none rounded bg-[var(--color-surface-hover)]" />
      <div className="mt-4 h-12 w-full animate-pulse motion-reduce:animate-none rounded bg-[var(--color-surface-hover)]" />
    </section>
  );
}

export function pendingCountLabel(
  countQuery: {
    readonly data: { readonly count: number } | undefined;
    readonly isError: boolean;
  },
  loaded: number,
): string {
  if (countQuery.data !== undefined) return `${countQuery.data.count} pending`;
  return countQuery.isError
    ? `Count unavailable · ${loaded} loaded`
    : `Count loading · ${loaded} loaded`;
}

export function ReopenRequestsPaging({
  listQuery,
}: {
  readonly listQuery: ReopenRequestsListQuery;
}) {
  return listQuery.isError ? (
    <DashboardNextPageIssue
      focusOnMount={listQuery.isFetchNextPageError}
      error={listQuery.error}
      isRetrying={listQuery.isFetching}
      onRetry={() => {
        if (listQuery.isFetchNextPageError) {
          void listQuery.fetchNextPage({ cancelRefetch: false });
        } else {
          void listQuery.refetch({ cancelRefetch: false });
        }
      }}
    />
  ) : listQuery.hasNextPage ? (
    <DashboardLoadMore
      isLoading={listQuery.isFetchingNextPage}
      onLoadMore={() => {
        void listQuery.fetchNextPage({ cancelRefetch: false });
      }}
    />
  ) : null;
}

function DashboardLoadMore({
  isLoading,
  onLoadMore,
}: {
  readonly isLoading: boolean;
  readonly onLoadMore: () => void;
}) {
  return (
    <div className="mt-4 flex justify-center">
      <button
        type="button"
        disabled={isLoading}
        onClick={onLoadMore}
        className="rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-[var(--color-card)] px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {isLoading ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}

function DashboardNextPageIssue({
  focusOnMount,
  error,
  isRetrying,
  onRetry,
}: {
  readonly focusOnMount: boolean;
  readonly error: unknown;
  readonly isRetrying: boolean;
  readonly onRetry: () => void;
}) {
  const focusRetry = useCallback(
    (element: HTMLButtonElement | null) => element?.focus(),
    [],
  );

  return (
    <div
      role="alert"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--color-destructive)] bg-[var(--color-status-blocked-bg)] p-3 text-sm text-[var(--color-destructive)]"
    >
      <span>
        Some requests could not be loaded:{" "}
        {error instanceof Error ? error.message : "Unknown error"}
      </span>
      <button
        ref={focusOnMount ? focusRetry : undefined}
        type="button"
        disabled={isRetrying}
        onClick={onRetry}
        className="rounded-[var(--radius-pill)] border border-current px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {isRetrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
