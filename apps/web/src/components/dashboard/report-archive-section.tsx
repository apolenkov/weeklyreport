"use client";

/**
 * Report archive list with real cursor pagination via TanStack Query's
 * useInfiniteQuery (wrapped by `useCursorPagination`).
 *
 * Self-contained: the section owns its own data fetching against
 * `trpc.archive.list` with `paginationInputSchema` (limit, cursor). Replaces
 * the previous static page-number pagination over the dashboard composer's
 * pre-loaded slice.
 *
 * Closes INT-08 (cursor pagination) for archive.list. Version history and
 * lead history use a client-side reveal because their tRPC endpoints are
 * not yet cursor-paginated at v5.0 — see SUMMARY.md.
 */

import { useTRPC } from "../../lib/trpc-context";
import { mapArchiveSummary } from "../../lib/mappers";
import { useCursorPagination } from "../../lib/use-cursor-pagination";
import type { ArchiveReportSummary } from "@customreport/shared";

type StatusConfig = { bg: string; text: string; label: string };

type ReportArchiveSectionProps = {
  readonly currentReportId?: string | null;
};

const STATUS_CONFIG = {
  active: {
    bg: "var(--color-success)",
    text: "var(--color-primary)",
    label: "Active",
  },
  published: {
    bg: "var(--color-primary)",
    text: "#fff",
    label: "Published",
  },
  draft: {
    bg: "#fef3c7",
    text: "#8a6d1b",
    label: "Draft",
  },
} as const satisfies Record<string, StatusConfig>;

const PAGE_SIZE = 12;

export function ReportArchiveSection({
  currentReportId,
}: ReportArchiveSectionProps = {}) {
  const trpc = useTRPC();

  const archive = useCursorPagination<ArchiveReportSummary>(
    (input) =>
      // The trpc proxy exposes `infiniteQueryOptions` per
      // @trpc/tanstack-react-query 11.16+. Cast to satisfy the hook's
      // useInfiniteQuery typings; runtime shape matches.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (trpc.archive.list as any).infiniteQueryOptions(
        { limit: input.limit ?? PAGE_SIZE },
        {
          getNextPageParam: (last: { nextCursor: string | null }) =>
            last.nextCursor ?? undefined,
          initialCursor: undefined,
        },
      ),
    { limit: PAGE_SIZE },
  );

  const reports = archive.items.map(mapArchiveSummary);
  const totalLoaded = reports.length;

  return (
    <div>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-sans)] text-xl font-semibold text-[var(--color-foreground)]">
          Report Archive
        </h2>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {archive.isLoading
            ? "Loading…"
            : `${totalLoaded} loaded${archive.hasNextPage ? "+" : ""}`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {reports.map((report) => {
          const isActive = report.id === currentReportId;
          const href = isActive
            ? `/head/report/${encodeURIComponent(report.id)}`
            : `/reports/${report.id}`;
          const config =
            (STATUS_CONFIG as Record<string, StatusConfig>)[report.status] ??
            STATUS_CONFIG.draft;
          const cardConfig = isActive ? STATUS_CONFIG.active : config;

          return (
            <a
              key={report.id}
              href={href}
              className="group cursor-pointer rounded-[var(--radius)] border bg-[var(--color-card)] p-4 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--color-starbucks-accent)] hover:shadow-[0_10px_24px_-18px_rgba(0,0,0,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2"
              style={{
                borderLeft: `3px solid ${
                  isActive
                    ? "var(--color-starbucks-accent)"
                    : "var(--color-border)"
                }`,
                textDecoration: "none",
                color: "inherit",
                boxShadow: isActive
                  ? "0 0 0 2px rgba(0,117,74,0.12), 0 8px 24px -16px rgba(0,0,0,0.2)"
                  : undefined,
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {report.weekLabel}
                </span>
                <span
                  className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: cardConfig.bg, color: cardConfig.text }}
                >
                  {cardConfig.label}
                </span>
              </div>
              <div className="text-xs text-[var(--color-muted-foreground)]">
                {report.dateRange}
              </div>
            </a>
          );
        })}
      </div>

      {/* Load more */}
      {archive.hasNextPage && (
        <div className="mt-4 flex items-center justify-center">
          <button
            type="button"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => archive.fetchNextPage()}
            disabled={archive.isFetchingNextPage}
            aria-label="Load more archived reports"
          >
            {archive.isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {!archive.isLoading && reports.length === 0 && (
        <p className="mt-4 text-center text-xs text-[var(--color-muted-foreground)]">
          No archived reports yet.
        </p>
      )}
    </div>
  );
}
