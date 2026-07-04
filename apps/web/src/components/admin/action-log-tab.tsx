"use client";

import { useMemo, useState } from "react";

import { useTRPC } from "../../lib/trpc-context";
import { useCursorPagination } from "../../lib/use-cursor-pagination";
import {
  copyToClipboard,
  formatTimestamp,
  humanizeProcedure,
  statusLabel,
  truncate,
} from "./action-log-format";
import { TabHeader, TabSearch } from "./tab-header";

interface ActionLogRow {
  id: string;
  createdAt: string;
  userId: string;
  role: string | null;
  procedure: string;
  targetId: string | null;
  status: string;
  reason: string | null;
  correlationId: string;
}

const PAGE_SIZE = 20;
const MAX_USER_ID_LENGTH = 18;
const MAX_TARGET_ID_LENGTH = 26;
const MAX_REFERENCE_ID_LENGTH = 14;
const COPY_FEEDBACK_MS = 1500;

export function ActionLogTab() {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");

  const pagination = useCursorPagination<ActionLogRow>(
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
  const visibleRows = useMemo(() => {
    const nonProofRows = rows.filter(
      (row) => !row.correlationId.startsWith("manual-action-log-proof"),
    );
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
  }, [rows, search]);

  return (
    <div className="space-y-4" data-testid="action-log-tab">
      <TabHeader
        title="Action Log"
        description="Latest product actions with support reference ids. Internal proof calls are hidden from this view."
        count={
          pagination.isLoading
            ? "Loading…"
            : `${rows.length} loaded${pagination.hasNextPage ? "+" : ""}`
        }
        search={
          <TabSearch
            value={search}
            onChange={setSearch}
            placeholder="Search actions…"
            testId="action-log-search"
            ariaLabel="Search actions"
          />
        }
      />

      {pagination.isLoading && <ActionLogSkeleton />}

      {pagination.isError && (
        <div
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-red-50 p-4 text-sm text-red-800"
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
            {rows.length === 0
              ? "No actions recorded yet."
              : "No actions match the search."}
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
                <tr
                  key={row.id}
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-hover)]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-muted-foreground)]">
                    {formatTimestamp(row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-[var(--color-foreground)]">
                      {truncate(row.userId, MAX_USER_ID_LENGTH)}
                    </div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {row.role ?? "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="text-xs font-semibold text-[var(--color-foreground)]"
                      title={row.procedure}
                    >
                      {humanizeProcedure(row.procedure)}
                    </div>
                    {row.targetId ? (
                      <div className="font-mono text-[11px] text-[var(--color-muted-foreground)]">
                        {truncate(row.targetId, MAX_TARGET_ID_LENGTH)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold ${
                        row.status === "success"
                          ? "bg-[var(--color-success)] text-[var(--color-primary)]"
                          : "bg-red-50 text-[var(--color-destructive)]"
                      }`}
                    >
                      {statusLabel(row.status)}
                    </span>
                    {row.reason ? (
                      <div
                        className="mt-1 max-w-[240px] truncate text-xs text-[var(--color-muted-foreground)]"
                        title={row.reason}
                      >
                        {row.reason}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <CorrelationCell value={row.correlationId} />
                  </td>
                </tr>
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

function CorrelationCell({ value }: { readonly value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        // Fire-and-forget copy: the click handler is a void slot, so chain
        // off the promise instead of returning it. Equivalent to the prior
        // `const ok = await copyToClipboard(value); if (ok) …`.
        void copyToClipboard(value).then((ok) => {
          if (ok) {
            setCopied(true);
            window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
          }
        });
      }}
      title={`${value} (click to copy)`}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] focus:bg-[var(--color-surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
      aria-label={`Copy reference id ${value}`}
    >
      <span>{truncate(value, MAX_REFERENCE_ID_LENGTH)}</span>
      <span
        className={`text-[10px] ${
          copied
            ? "text-[var(--color-primary)]"
            : "text-[var(--color-muted-foreground)]"
        }`}
        aria-hidden="true"
      >
        {copied ? "✓ copied" : "📋"}
      </span>
    </button>
  );
}

function ActionLogSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <div className="skeleton h-10 w-full" />
      <div className="skeleton h-10 w-full" />
      <div className="skeleton h-10 w-3/4" />
    </div>
  );
}
