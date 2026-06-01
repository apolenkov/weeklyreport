"use client";

/**
 * Archived report list with real cursor pagination via TanStack Query's
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

import type { ArchiveReportSummary } from "@customreport/shared";
import { formatDate, formatPeriodLabel } from "../../lib/format-date";
import { useTRPC } from "../../lib/trpc-context";
import { useCursorPagination } from "../../lib/use-cursor-pagination";

interface ReportArchiveSectionProps {
  readonly currentReportId?: string | null;
}

const PAGE_SIZE = 12;

function TrafficDot({
  label,
  count,
  className,
}: {
  readonly label: string;
  readonly count: number;
  readonly className: string;
}) {
  return (
    <span
      role="img"
      className="inline-flex h-7 min-w-12 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.08)] bg-white/70 px-2 text-[12px] font-semibold text-[var(--color-foreground)]"
      aria-label={`${label}: ${count}`}
    >
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {count}
    </span>
  );
}

function TimelineRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-[12px]">
      <span className="shrink-0 text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <span className="min-w-0 truncate text-right font-medium text-[var(--color-foreground)]">
        {value}
      </span>
    </div>
  );
}

function portfolioCounts(status: ArchiveReportSummary["portfolioStatus"]) {
  return {
    green: status === "green" ? 1 : 0,
    yellow: status === "yellow" ? 1 : 0,
    red: status === "red" ? 1 : 0,
  };
}

function portfolioSummary(status: ArchiveReportSummary["portfolioStatus"]) {
  if (status === "green") return "All green | Compiled report";
  if (status === "yellow") return "Yellow portfolio status | Compiled report";
  return "Red portfolio status | Compiled report";
}

export function ReportArchiveSection({
  currentReportId,
}: ReportArchiveSectionProps = {}) {
  const trpc = useTRPC();

  const archive = useCursorPagination<ArchiveReportSummary>(
    (input) =>
      // The trpc proxy exposes `infiniteQueryOptions` per
      // @trpc/tanstack-react-query 11.16+. Cast to satisfy the hook's
      // useInfiniteQuery typings; runtime shape matches.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional any for test/runtime escape hatch (migrated from eslint-disable)
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

  const reports = archive.items;
  const totalLoaded = reports.length;

  return (
    <div>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-sans)] text-xl font-semibold text-[var(--color-foreground)]">
          Archive
        </h2>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {archive.isLoading
            ? "Loading…"
            : `${totalLoaded} loaded${archive.hasNextPage ? "+" : ""}`}
        </span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {archive.isLoading ? (
          <ArchiveSkeletonGrid />
        ) : (
          reports.map((report) => {
            const isActive = report.reportId === currentReportId;
            const href = isActive
              ? `/head/report/${encodeURIComponent(report.reportId)}`
              : `/reports/${report.reportId}`;
            const periodLabel = formatPeriodLabel(
              report.periodStart,
              report.periodEnd,
            );
            const traffic = portfolioCounts(report.portfolioStatus);

            return (
              <a
                key={report.reportId}
                href={href}
                className="group block overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)] transition-[box-shadow,border-color,background-color] hover:shadow-[0_0_0.5px_0_rgba(0,0,0,0.12),0_12px_26px_-18px_rgba(0,0,0,0.22),0_2px_4px_rgba(0,0,0,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-starbucks-accent)] focus-visible:ring-offset-2"
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
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-[family-name:var(--font-sans)] text-base font-semibold tracking-[-0.01em] text-[var(--color-foreground)]">
                    {periodLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white">
                    Archived
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <TrafficDot
                    label="Green statuses"
                    count={traffic.green}
                    className="bg-[var(--color-starbucks-accent)]"
                  />
                  <TrafficDot
                    label="Yellow statuses"
                    count={traffic.yellow}
                    className="bg-[#d4a017]"
                  />
                  <TrafficDot
                    label="Red statuses"
                    count={traffic.red}
                    className="bg-[var(--color-destructive)]"
                  />
                </div>

                <p className="mt-3 line-clamp-2 text-[13px] leading-5 text-[var(--color-muted-foreground)]">
                  {portfolioSummary(report.portfolioStatus)}
                </p>

                <div className="mt-4 space-y-1.5 border-t border-[rgba(0,0,0,0.07)] pt-3">
                  <TimelineRow
                    label="Published"
                    value={formatDate(report.publishedAt)}
                  />
                  <TimelineRow label="Owner" value={report.publishedByName} />
                </div>
              </a>
            );
          })
        )}
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

const SKELETON_KEYS = [
  "sk-0",
  "sk-1",
  "sk-2",
  "sk-3",
  "sk-4",
  "sk-5",
  "sk-6",
  "sk-7",
] as const;

function ArchiveSkeletonGrid() {
  return SKELETON_KEYS.map((key) => (
    <div
      key={key}
      aria-hidden="true"
      className="min-h-[201px] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5"
      style={{ borderLeft: "3px solid var(--color-border)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="h-5 w-32 rounded bg-[var(--color-muted)]" />
        <div className="h-6 w-24 rounded-[var(--radius-pill)] bg-[var(--color-muted)]" />
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-7 w-12 rounded-[var(--radius-pill)] bg-[var(--color-muted)]" />
        <div className="h-7 w-12 rounded-[var(--radius-pill)] bg-[var(--color-muted)]" />
        <div className="h-7 w-12 rounded-[var(--radius-pill)] bg-[var(--color-muted)]" />
      </div>
      <div className="mt-3 h-5 w-full rounded bg-[var(--color-muted)]" />
      <div className="mt-4 space-y-2 border-t border-[rgba(0,0,0,0.07)] pt-3">
        <div className="h-3 w-full rounded bg-[var(--color-muted)]" />
        <div className="h-3 w-11/12 rounded bg-[var(--color-muted)]" />
      </div>
    </div>
  ));
}
