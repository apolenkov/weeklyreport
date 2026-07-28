"use client";

import { useMemo, useState } from "react";

import { useTRPC } from "../../../lib/trpc-context";
import { useCursorPagination } from "../../../lib/use-cursor-pagination";
import { TabHeader, TabSearch } from "../../../shared/ui/tab-header";
import { ActionLogRow, type ActionLogRowData } from "./action-log-row";
import { ActionLogSkeleton } from "./action-log-skeleton";

const PAGE_SIZE = 20;
// Proof-seed correlation prefix: exclude so empty/search-miss treat a
// page of only proof rows as an empty log.
const MANUAL_ACTION_LOG_PROOF_PREFIX = "manual-action-log-proof";

const COLUMN_HEADERS = [
  "Time",
  "User",
  "Procedure",
  "Status",
  "Reference",
] as const;

function ActionLogTable({ rows }: { readonly rows: ActionLogRowData[] }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
            {COLUMN_HEADERS.map((header) => (
              <th
                key={header}
                className="px-4 py-3 font-semibold text-[var(--color-foreground)]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ActionLogRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
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
  return useCursorPagination<ActionLogRowData>(
    (input) =>
      trpc.admin.actionLog.list.infiniteQueryOptions(
        { limit: input.limit ?? PAGE_SIZE },
        {
          getNextPageParam: (last: { nextCursor: string | null }) =>
            last.nextCursor ?? undefined,
        },
      ),
    { limit: PAGE_SIZE },
  );
}

// Search is a substring match over every displayed column of a loaded row.
function matchesNeedle(row: ActionLogRowData, needle: string): boolean {
  return [
    row.userId,
    row.role ?? "",
    row.procedure,
    row.targetId ?? "",
    row.status,
    row.reason ?? "",
    row.correlationId,
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function useActionLogRows(rows: ActionLogRowData[], search: string) {
  const nonProofRows = useMemo(
    () =>
      rows.filter(
        (row) => !row.correlationId.startsWith(MANUAL_ACTION_LOG_PROOF_PREFIX),
      ),
    [rows],
  );
  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return nonProofRows;
    return nonProofRows.filter((row) => matchesNeedle(row, needle));
  }, [nonProofRows, search]);
  return { nonProofRows, visibleRows };
}

/**
 * Action Log Tab.
 */
export function ActionLogTab() {
  const [search, setSearch] = useState("");
  const pagination = useActionLogPagination();
  const { nonProofRows, visibleRows } = useActionLogRows(
    pagination.items,
    search,
  );

  return (
    <div className="space-y-4" data-testid="action-log-tab">
      <TabHeader
        title="Action Log"
        description="Latest product actions with support reference ids. Search covers loaded rows only; internal proof calls are hidden."
        count={
          pagination.isLoading
            ? "Loading…"
            : `${visibleRows.length} loaded${pagination.hasNextPage ? "+" : ""}`
        }
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
          <ActionLogEmpty hasLoadedRows={nonProofRows.length > 0} />
        )}

      {visibleRows.length > 0 && <ActionLogTable rows={visibleRows} />}

      {pagination.hasNextPage && (
        <LoadMoreButton
          onClick={pagination.fetchNextPage}
          isFetching={pagination.isFetchingNextPage}
        />
      )}
    </div>
  );
}
