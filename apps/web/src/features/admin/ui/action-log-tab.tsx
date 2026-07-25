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

export function ActionLogTab() {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");

  const pagination = useCursorPagination<ActionLogRowData>(
    (input) =>
      trpc.admin.actionLog.list.infiniteQueryOptions(
        { limit: input.limit ?? PAGE_SIZE },
        {
          getNextPageParam: (last: { nextCursor: string | null }) =>
            last.nextCursor ?? undefined,
          initialCursor: undefined,
        },
      ),
    { limit: PAGE_SIZE },
  );

  const rows = pagination.items;
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
    return nonProofRows.filter((row) =>
      [
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
        .includes(needle),
    );
  }, [nonProofRows, search]);

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

      {pagination.isError && (
        <div
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-[var(--color-destructive)] p-4 text-sm text-[var(--color-destructive-foreground)]"
        >
          Failed to load action log:{" "}
          {pagination.error instanceof Error
            ? pagination.error.message
            : "Unknown error"}
        </div>
      )}

      {!pagination.isLoading &&
        !pagination.isError &&
        visibleRows.length === 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
            {nonProofRows.length === 0
              ? "No actions recorded yet."
              : "No loaded actions match the search."}
          </div>
        )}

      {visibleRows.length > 0 && (
        <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Time
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  User
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Procedure
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Status
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-foreground)]">
                  Reference
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <ActionLogRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={pagination.fetchNextPage}
            disabled={pagination.isFetchingNextPage}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2 text-sm text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
          >
            {pagination.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
