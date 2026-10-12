"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import type { AdminActionLogEvent } from "@weeklyreport/shared";
import { useId, useMemo, useState } from "react";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { TabHeader, TabSearch } from "../../../shared/ui/tabs/tab-header";
import { matchesActionLogSearch } from "../model/action-log-model";
import type { AdminUserView } from "../model/admin-types";
import { ActionLogRow } from "./action-log-row";
import { ActionLogSkeleton } from "./action-log-skeleton";

const PAGE_SIZE = 20;

const COLUMN_HEADERS = [
  "Time",
  "User",
  "Procedure",
  "Status",
  "Reference",
  "Details",
] as const;

function ActionLogTable({
  rows,
  userNames,
}: {
  readonly rows: readonly AdminActionLogEvent[];
  readonly userNames: ReadonlyMap<string, string>;
}) {
  const scrollHintId = useId();
  return (
    <div className="space-y-2">
      <p
        id={scrollHintId}
        className="text-xs text-[var(--color-muted-foreground)] sm:hidden"
      >
        Scroll horizontally to see status and details.
      </p>
      <div
        role="region"
        aria-label="Action log table"
        aria-describedby={scrollHintId}
        tabIndex={0}
        className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] shadow-[var(--shadow-card-resting)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        <table className="w-full min-w-[32rem] text-left text-sm sm:min-w-0">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
              {COLUMN_HEADERS.map((header) => (
                <th
                  key={header}
                  className={`px-4 py-3 font-semibold text-[var(--color-foreground)]${header === "Time" || header === "Reference" ? " hidden sm:table-cell" : ""}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <ActionLogRow
                key={row.id}
                row={row}
                userName={userNames.get(row.userId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionLogLoadFailed({ error }: { readonly error: unknown }) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-[var(--color-destructive)] p-4 text-sm text-[var(--color-destructive-foreground)]"
    >
      Failed to load action log:{" "}
      {error instanceof Error ? error.message : "Unknown error"}
    </div>
  );
}

// An empty log and a search that matched nothing read differently to the admin.
function ActionLogEmpty({
  hasLoadedRows,
}: {
  readonly hasLoadedRows: boolean;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
      {hasLoadedRows
        ? "No loaded actions match the search."
        : "No actions recorded yet."}
    </div>
  );
}

function LoadMoreButton({
  onClick,
  isFetching,
}: {
  readonly onClick: () => void;
  readonly isFetching: boolean;
}) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        onClick={onClick}
        disabled={isFetching}
        className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
      >
        {isFetching ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}

function useActionLogPagination() {
  const trpc = useTRPC();
  const query = useInfiniteQuery(
    trpc.admin.actionLog.list.infiniteQueryOptions(
      { limit: PAGE_SIZE },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    ),
  );
  useQueryErrorHandler(query, {
    component: "ActionLogTab",
    event: "admin.action_log.list_failed",
    procedure: "admin.actionLog.list",
  });
  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data?.pages],
  );
  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage({ cancelRefetch: false });
    },
  };
}

function useActionLogRows(
  rows: readonly AdminActionLogEvent[],
  search: string,
  userNames: ReadonlyMap<string, string>,
) {
  return useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        matchesActionLogSearch(row, search) ||
        (userNames.get(row.userId)?.toLowerCase().includes(needle) ?? false),
    );
  }, [rows, search, userNames]);
}

export function ActionLogTab({
  users,
}: {
  readonly users?: readonly Pick<AdminUserView, "id" | "name">[] | undefined;
}) {
  const [search, setSearch] = useState("");
  const userNames = useMemo(
    () => new Map(users?.map((user) => [user.id, user.name])),
    [users],
  );
  const pagination = useActionLogPagination();
  const visibleRows = useActionLogRows(pagination.items, search, userNames);
  const loadedCount = `${pagination.items.length} loaded${pagination.hasNextPage ? " · more available" : ""}`;
  const count = search.trim()
    ? `${visibleRows.length} matches · ${loadedCount}`
    : loadedCount;

  return (
    <div className="space-y-4" data-testid="action-log-tab">
      <TabHeader
        title="Action Log"
        description="Latest product actions with support reference ids. Search covers loaded rows only."
        count={pagination.isLoading ? "Loading…" : count}
        search={
          <TabSearch
            value={search}
            onChange={setSearch}
            placeholder="Search loaded actions…"
            testId="action-log-search"
            ariaLabel="Search loaded actions"
          />
        }
      />

      {pagination.isLoading && <ActionLogSkeleton />}

      {pagination.isError && <ActionLogLoadFailed error={pagination.error} />}

      {!pagination.isLoading &&
        !pagination.isError &&
        visibleRows.length === 0 && (
          <ActionLogEmpty hasLoadedRows={pagination.items.length > 0} />
        )}

      {visibleRows.length > 0 && (
        <ActionLogTable rows={visibleRows} userNames={userNames} />
      )}

      {pagination.hasNextPage && (
        <LoadMoreButton
          onClick={pagination.fetchNextPage}
          isFetching={pagination.isFetchingNextPage}
        />
      )}
    </div>
  );
}
