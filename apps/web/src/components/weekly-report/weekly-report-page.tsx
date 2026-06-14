"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useContext, useEffect, useMemo } from "react";

import { getClientErrorDetails } from "../../lib/client-error-reporting";
import { joinPeriodLabel } from "../../lib/format-date";
import { mapWeeklyReport } from "../../lib/mappers";
import { formatDateRange, isoWeekNumber } from "../../lib/mappers/lead-history";
import { SessionContext } from "../../lib/session-provider";
import { useTRPC } from "../../lib/trpc-context";
import { useQueryErrorHandler } from "../../lib/use-query-error-handler";
import type {
  PortfolioProduct,
  ProductReport,
  ReportPeriod,
} from "../dashboard/mock-data";
import {
  ReportToolbar,
  ReportToolbarCenterLabel,
} from "../report-shell/report-toolbar";
import { HeadPeriodNavigator } from "./period-navigator";
import { PortfolioOverviewTable } from "./portfolio-overview-table";
import { ProductAccordion } from "./product-accordion";
import { ReportMutationActions } from "./report-mutation-actions";
import { WeeklyReportSkeleton } from "./weekly-report-skeleton";

interface WeeklyReportPageProps {
  /**
   * Concrete report identifier (UUID). When provided, the query targets that
   * specific report; used by /reports/[reportId] route pages.
   */
  readonly reportId?: string;
  /**
   * 35-07: when true, the page auto-redirects (router.replace) to the
   * canonical addressed URL `/head/report/<reportId>` once the active
   * reportId is known. Off when already on a `[reportId]` route.
   *
   * Optional `canonicalBasePath` (defaults to `/head/report`) lets callers
   * point the redirect at a different addressed surface.
   */
  readonly redirectToCanonical?: boolean;
  readonly canonicalBasePath?: string;
  readonly authorId?: string;
  /**
   * Grouping axis (head split-view parity, UAT 2026-05-22). "product" (default)
   * is the classic per-product accordion list; "lead" groups products under
   * each authoring lead. A product shared by several leads appears under each —
   * leads own their own phases, so the duplication is expected.
   */
  readonly scope?: "product" | "lead";
  /**
   * head-toolbar-parity D2: a page must not stack two period toolbars. When
   * an outer shell (HeadReportShell) composes the page's single shared
   * ReportToolbar, it passes the element here; the page renders it in the
   * toolbar slot below the page header row — the lead arrangement — instead
   * of its own period-context toolbar. Standalone consumers (bare
   * /head/report, /reports/[reportId], lead preview, present client) omit it
   * and keep the page's own toolbar.
   */
  readonly toolbar?: ReactNode;
  /**
   * lead-live-walk-2026-06-14 task 5.3: suppress the in-header period-mutation
   * cluster (Export-PDF + Archive + Publish). The head report shell sets this
   * because it renders the SAME ReportMutationActions inside the shared
   * ReportActionsPill (one consolidated bar across form + slides). Off by
   * default so every standalone consumer keeps the cluster in the page header.
   */
  readonly suppressHeaderActions?: boolean;
}

/**
 * Centered title + body card used for the page's terminal states (invalid-link,
 * no active period). Extracted so the two states share one layout and the page
 * function stays under the cognitive-complexity budget.
 */
function CenteredNotice({
  title,
  body,
}: {
  readonly title: string;
  readonly body: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-lg font-semibold text-[var(--color-foreground)]">
        {title}
      </p>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        {body}
      </p>
    </div>
  );
}

interface TerminalNotice {
  readonly title: string;
  readonly body: string;
}

/**
 * Resolves the page's terminal display state (after loading settles).
 *  - invalid-link (driver finding 1): a malformed reportId (400 BAD_REQUEST) or
 *    a missing report (404 NOT_FOUND). Transient 5xx / network errors fall
 *    through to no-period (unchanged behavior).
 *  - no active period (R3a): no data, or a `no-period` status.
 * Returns null when the report should render normally.
 */
function resolveTerminalNotice(query: {
  readonly isError: boolean;
  readonly error: unknown;
  readonly data: { readonly status: string } | undefined;
}): TerminalNotice | null {
  if (query.isError && getClientErrorDetails(query.error).isInvalidLink) {
    return {
      title: "Report not found",
      body: "This link is invalid or the report no longer exists.",
    };
  }
  if (!query.data || query.data.status === "no-period") {
    return {
      title: "No active reporting period",
      body: "Ask an admin to open a new period to start collecting status reports.",
    };
  }
  return null;
}

export function WeeklyReportPage({
  reportId,
  redirectToCanonical,
  canonicalBasePath = "/head/report",
  authorId,
  scope = "product",
  toolbar,
  suppressHeaderActions = false,
}: WeeklyReportPageProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const focusedAuthorId = authorId ?? null;
  // UFB-047 / Phase 49-01: department label is the Organization singleton's
  // `fullName`, hydrated per-request on `auth.me`. The legacy fallback to
  // `weeklyReport.get.departmentName` was removed when the column dropped.
  const sessionState = useContext(SessionContext);
  const orgFullName = sessionState?.organization?.fullName ?? null;

  // weeklyReport.get input: { reportId?: string } | undefined.
  // When reportId is given, scope to that report; otherwise fall back to the
  // session's active period (server-side default).
  const queryInput = reportId ? { reportId } : {};
  const weeklyQ = useQuery(trpc.weeklyReport.get.queryOptions(queryInput));

  useQueryErrorHandler(weeklyQ, {
    event: "weeklyReport.get.load_failed",
    component: "WeeklyReportPage",
    procedure: "weeklyReport.get",
    context: { reportId: reportId ?? null, authorId: focusedAuthorId },
    toastPrefix: "Failed to load status report",
  });

  // 35-07: bare `/head/report` -> redirect to `/head/report/<reportId>`
  // once the active reportId is known. Skipped when:
  //   • the page already renders under `[reportId]` (reportId prop set)
  //   • there is no resolvable report (weeklyQ data not loaded or no-period)
  const resolvedReportId =
    weeklyQ.data?.status === "active" ? weeklyQ.data.reportId : null;
  useEffect(() => {
    if (!redirectToCanonical) return;
    if (reportId) return;
    if (!resolvedReportId) return;
    const authorQuery = focusedAuthorId
      ? `?authorId=${encodeURIComponent(focusedAuthorId)}`
      : "";
    router.replace(`${canonicalBasePath}/${resolvedReportId}${authorQuery}`);
  }, [
    redirectToCanonical,
    reportId,
    resolvedReportId,
    focusedAuthorId,
    router,
    canonicalBasePath,
  ]);

  // 35-07: surface the period in the browser tab title.
  const titleParts = useMemo(() => {
    if (!weeklyQ.data || weeklyQ.data.status === "no-period") return null;
    const start = weeklyQ.data.periodStart;
    const end = weeklyQ.data.periodEnd;
    if (!(start instanceof Date) || !(end instanceof Date)) return null;
    return { week: isoWeekNumber(start), range: formatDateRange(start, end) };
  }, [weeklyQ.data]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!titleParts) return;
    const previous = document.title;
    document.title = `Week ${titleParts.week}, ${titleParts.range} - CustomReport`;
    return () => {
      document.title = previous;
    };
  }, [titleParts]);

  if (weeklyQ.isLoading) {
    return <WeeklyReportSkeleton />;
  }

  // Terminal states (driver finding 1 invalid-link + R3a no-period). Resolved
  // by a pure helper so the page function stays under the complexity budget.
  const terminalNotice = resolveTerminalNotice(weeklyQ);
  if (terminalNotice) {
    return (
      <CenteredNotice title={terminalNotice.title} body={terminalNotice.body} />
    );
  }

  // After the terminal-notice guard the report is loaded and active; this
  // narrows weeklyQ.data off the `no-period` / undefined variants for TS.
  const reportData = weeklyQ.data;
  if (!reportData || reportData.status === "no-period") {
    return null;
  }

  const view = mapWeeklyReport(reportData);
  const submitted = view.submissionCount;
  const total = view.totalLeads;

  // The mapper produces structurally compatible shapes; cast to the existing
  // mock-data presentation types so children keep their imports unchanged.
  const portfolio: PortfolioProduct[] = view.portfolio;
  const products: ProductReport[] = view.products;
  // Head split-view "by lead" grouping (UAT 2026-05-22): resolve author names
  // from the period's lead sections, then bucket products under each lead they
  // authored. Empty leads are dropped so the view never shows blank groups.
  // Computed only in "lead" scope to keep the default product path cheap.
  const leadGroups =
    scope === "lead"
      ? (() => {
          const nameById = new Map<string, string>();
          for (const section of reportData.leadSections) {
            if (section.authorId) {
              nameById.set(section.authorId, section.authorName);
            }
          }
          return [...nameById.entries()]
            .map(([id, name]) => ({
              id,
              name,
              // authorIds is typed optional on ProductReport but the mapper
              // always emits an array; guard defensively all the same.
              products: products.filter((report) =>
                report.authorIds?.includes(id),
              ),
            }))
            .filter((group) => group.products.length > 0);
        })()
      : [];
  // UFB-047 / Phase 49-01: department label is exclusively
  // `auth.me.organization.fullName`. PDF-worker / non-session callers
  // get a sensible default — the brand never blanks out.
  const departmentLabel = orgFullName ?? "CustomReport";

  const hasReportContent = (report: ProductReport) =>
    Boolean(report.needsAttention) ||
    report.currentWeek.length > 0 ||
    report.nextWeek.length > 0 ||
    report.risks.length > 0 ||
    report.decisions.length > 0 ||
    report.priorities.length > 0;
  const authoredProductIds = focusedAuthorId
    ? products
        .filter((report) => report.authorIds?.includes(focusedAuthorId))
        .map((report) => report.id)
    : [];
  const focusedProductId = focusedAuthorId
    ? products.find(
        (report) =>
          report.authorIds?.includes(focusedAuthorId) &&
          hasReportContent(report),
      )?.id
    : undefined;
  const scrollTargetProductId =
    authoredProductIds.length > 0 ? authoredProductIds[0] : undefined;
  // HeadPeriodNavigator currently renders one period entry; future plans may
  // surface a list of recent periods. For now, surface the active period only.
  const periods: ReportPeriod[] = [
    {
      id: view.period.id,
      weekLabel: view.period.weekLabel,
      dateRange: view.period.dateRange,
      isCurrent: view.period.isCurrent,
    },
  ];
  const periodLabel = joinPeriodLabel(
    view.period.weekLabel,
    view.period.dateRange,
  );

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            Status Report
          </h1>
          <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
            Live &middot; {submitted}/{total} Submitted
          </span>
        </div>
        {/* lead-live-walk-2026-06-14 task 5.3: Export-PDF + Archive + Publish
            live in ReportMutationActions. Standalone consumers (viewer, lead
            preview, present, bare /head/report) render the cluster here in the
            page header row. The head report shell suppresses it
            (suppressHeaderActions) and renders the SAME component inside the
            shared ReportActionsPill — one consolidated bar, both modes. */}
        {!suppressHeaderActions && (
          <div className="flex items-center gap-3">
            <ReportMutationActions reportId={reportId} />
          </div>
        )}
      </div>

      {/* Period-context toolbar: shared ReportToolbar container
          (head-toolbar-parity D2 — replaces the bespoke gradient bar). A
          shell-composed toolbar arrives via the `toolbar` slot and renders
          here, below the page header row, so the page keeps the lead
          arrangement and never stacks two period toolbars. */}
      {toolbar ?? (
        <ReportToolbar
          periodNavigator={<HeadPeriodNavigator periods={periods} />}
          leadingExtras={
            <ReportToolbarCenterLabel
              label={departmentLabel}
              detail="Live portfolio review"
            />
          }
        />
      )}

      {/* A32: empty-state — no submissions in current open/reopened period.
          When submissionCount === 0 and the period is not yet published,
          replace the (blank) portfolio table and accordion with a helpful
          nudge. Keeps header + period nav intact so the head retains context. */}
      {submitted === 0 && view.period.periodStatus !== "published" ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center"
          data-testid="empty-submissions-state"
        >
          <p className="text-base font-semibold text-[var(--color-foreground)]">
            No submissions yet for {periodLabel}
          </p>
          <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">
            Leads have not filed their sections for this period.
          </p>
          <Link
            href="/reports?tab=published"
            className="mt-4 text-sm font-medium text-[var(--color-primary)] underline-offset-4 hover:underline"
          >
            View archived reports in Archive &rarr;
          </Link>
        </div>
      ) : (
        <>
          {/* Portfolio Overview */}
          <PortfolioOverviewTable products={portfolio} />

          {/* Accordion sections — by product (default) or grouped by lead */}
          {scope === "lead" ? (
            <div className="space-y-6">
              {leadGroups.map((group) => (
                <section
                  key={group.id}
                  aria-label={group.name}
                  className="space-y-3"
                >
                  <h3 className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-primary)]">
                    {group.name}
                  </h3>
                  {group.products.map((report) => (
                    <ProductAccordion
                      key={report.id}
                      report={report}
                      defaultOpen={focusedProductId === report.id}
                      highlighted={focusedProductId === report.id}
                      scrollIntoViewOnHighlight={
                        scrollTargetProductId === report.id
                      }
                    />
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((report) => (
                <ProductAccordion
                  key={report.id}
                  report={report}
                  defaultOpen={focusedProductId === report.id}
                  highlighted={focusedProductId === report.id}
                  scrollIntoViewOnHighlight={
                    scrollTargetProductId === report.id
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
