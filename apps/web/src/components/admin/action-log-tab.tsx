"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc-context";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + "…";
}

export function ActionLogTab() {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const listQuery = useQuery(
    trpc.admin.actionLog.list.queryOptions({ limit: 50 }),
  );
  const rows = useMemo(() => listQuery.data?.rows ?? [], [listQuery.data]);
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
      <div>
        <h2 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
          Action Log
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
          Latest product actions with support reference ids. Internal proof
          calls are hidden from this view.
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search actions…"
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-white px-3 py-2.5 text-sm text-[var(--color-foreground)] focus:border-[var(--color-starbucks-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
        aria-label="Search actions"
      />

      {listQuery.isPending && <ActionLogSkeleton />}

      {listQuery.isError && (
        <div
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--color-destructive)] bg-red-50 p-4 text-sm text-red-800"
        >
          Failed to load action log: {listQuery.error.message}
        </div>
      )}

      {!listQuery.isPending &&
        !listQuery.isError &&
        visibleRows.length === 0 && (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] bg-[#fafaf7] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
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
                  className="border-b border-[var(--color-border)] last:border-0 hover:bg-[#f8f6f2]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--color-muted-foreground)]">
                    {formatTimestamp(row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-[var(--color-foreground)]">
                      {truncate(row.userId, 18)}
                    </div>
                    <div className="text-xs text-[var(--color-muted-foreground)]">
                      {row.role ?? "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-[var(--color-foreground)]">
                      {row.procedure}
                    </div>
                    {row.targetId ? (
                      <div className="font-mono text-[11px] text-[var(--color-muted-foreground)]">
                        {truncate(row.targetId, 26)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "inline-flex rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-semibold " +
                        (row.status === "success"
                          ? "bg-[var(--color-success)] text-[var(--color-primary)]"
                          : "bg-red-50 text-[var(--color-destructive)]")
                      }
                    >
                      {row.status}
                    </span>
                    {row.reason ? (
                      <div className="mt-1 max-w-[240px] truncate text-xs text-[var(--color-muted-foreground)]">
                        {row.reason}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-foreground)]">
                    {row.correlationId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
