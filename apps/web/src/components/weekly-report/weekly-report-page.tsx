"use client";

import { useContext, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { isoWeekNumber, formatDateRange } from "../../lib/mappers/lead-history";

import { useTRPC } from "../../lib/trpc-context";
import { SessionContext } from "../../lib/session-provider";
import {
  formatClientErrorMessage,
  logClientError,
} from "../../lib/client-error-reporting";
import { mapWeeklyReport } from "../../lib/mappers";
import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../lib/cache-keys";
import type {
  PortfolioProduct,
  ProductReport,
  ReportPeriod,
} from "../dashboard/mock-data";

import { HeadPeriodNavigator } from "./period-navigator";
import { PortfolioOverviewTable } from "./portfolio-overview-table";
import { ProductAccordion } from "./product-accordion";
import { PublishLockButton } from "./publish-lock-button";
import { ExportPdfButton } from "./export-pdf-button";
import { WeeklyReportSkeleton } from "./weekly-report-skeleton";
import { AiSummaryCard } from "../ai/ai-summary-card";

type WeeklyReportPageProps = {
  /**
   * Period id (week label string) hint from the URL `?period=...` query param.
   * `weeklyReport.get` does NOT take a period filter at v5.0 — when no
   * `reportId` is given the server resolves the active period itself. The
   * `period` prop is preserved for forward-compat / future period-scoped
   * routing.
   */
  readonly period?: string;
  /**
   * Concrete report identifier (UUID). When provided, the query targets that
   * specific report; used by /reports/[reportId] route pages.
   */
  readonly reportId?: string;
  /**
   * 35-07: when true, the page auto-redirects (router.replace) to the
   * canonical addressed URL `/head/report/<reportId>` once the active
   * reportId is known. Off when the bare route is hit with `?period=`
   * (legacy bookmarks) or when already on a `[reportId]` route.
   *
   * Optional `canonicalBasePath` (defaults to `/head/report`) lets callers
   * point the redirect at a different addressed surface.
   */
  readonly redirectToCanonical?: boolean;
  readonly canonicalBasePath?: string;
  readonly authorId?: string;
};

export function WeeklyReportPage({
  period,
  reportId,
  redirectToCanonical,
  canonicalBasePath = "/head/report",
  authorId,
}: WeeklyReportPageProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
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

  // Phase 22 (plan 22-05): wire period.publish + period.reopen to the head's
  // Publish & Lock / Reopen button. On success, cascade cache invalidation
  // across dashboard, lead form, and lead history surfaces so all consumers
  // refetch fresh state without a manual refresh.
  const publishMut = useMutation(
    trpc.period.publish.mutationOptions({
      onSuccess: () => {
        invalidateDashboard(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        toast.success("Period published & locked");
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to publish period",
        );
      },
    }),
  );

  const reopenMut = useMutation(
    trpc.period.reopen.mutationOptions({
      onSuccess: () => {
        invalidateDashboard(qc, trpc);
        invalidateLeadForm(qc, trpc);
        invalidateLeadHistory(qc, trpc);
        toast.success("Period reopened");
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to reopen period",
        );
      },
    }),
  );

  useEffect(() => {
    if (weeklyQ.isError) {
      logClientError("weeklyReport.get.load_failed", weeklyQ.error, {
        component: "WeeklyReportPage",
        procedure: "weeklyReport.get",
        reportId: reportId ?? null,
        period: period ?? null,
        authorId: focusedAuthorId,
      });
      toast.error(
        formatClientErrorMessage("Failed to load status report", weeklyQ.error),
      );
    }
  }, [weeklyQ.isError, weeklyQ.error, reportId, period, focusedAuthorId]);

  // 35-07: bare `/head/report` -> redirect to `/head/report/<reportId>`
  // once the active reportId is known. Skipped when:
  //   • a `?period=` query is present (legacy bookmarks)
  //   • the page already renders under `[reportId]` (reportId prop set)
  //   • there is no resolvable report (weeklyQ data not loaded)
  const resolvedReportId = weeklyQ.data?.reportId ?? null;
  useEffect(() => {
    if (!redirectToCanonical) return;
    if (period) return;
    if (reportId) return;
    if (!resolvedReportId) return;
    const authorQuery = focusedAuthorId
      ? `?authorId=${encodeURIComponent(focusedAuthorId)}`
      : "";
    router.replace(`${canonicalBasePath}/${resolvedReportId}${authorQuery}`);
  }, [
    redirectToCanonical,
    period,
    reportId,
    resolvedReportId,
    focusedAuthorId,
    router,
    canonicalBasePath,
  ]);

  // 35-07: surface the period in the browser tab title.
  const titleParts = useMemo(() => {
    if (!weeklyQ.data) return null;
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

  if (weeklyQ.isLoading || !weeklyQ.data) {
    return <WeeklyReportSkeleton />;
  }

  const view = mapWeeklyReport(weeklyQ.data);
  const submitted = view.submissionCount;
  const total = view.totalLeads;
  // pendingCount mirrors mock semantics: total - submitted, clamped >= 0.
  const pendingCount = Math.max(0, total - submitted);

  // The mapper produces structurally compatible shapes; cast to the existing
  // mock-data presentation types so children keep their imports unchanged.
  const portfolio: PortfolioProduct[] = view.portfolio as PortfolioProduct[];
  const products: ProductReport[] = view.products as ProductReport[];
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
  const hasExpandableProducts = products.some(hasReportContent);
  const canPublishReport = submitted > 0 && hasExpandableProducts;
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
        <div className="flex items-center gap-3">
          <ExportPdfButton
            reportId={view.period.reportId}
            periodStatus={view.period.periodStatus}
          />
          <PublishLockButton
            pendingCount={pendingCount}
            totalLeads={total}
            periodStatus={view.period.periodStatus}
            onPublish={() =>
              publishMut.mutate({ reportId: view.period.reportId })
            }
            onReopen={() =>
              reopenMut.mutate({ reportId: view.period.reportId })
            }
            isPending={publishMut.isPending || reopenMut.isPending}
            canPublish={canPublishReport}
            publishDisabledReason="No submitted report content yet."
          />
        </div>
      </div>

      {/* Context shell: Period nav + department */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.78)_100%)] px-4 py-3.5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.06),0_10px_24px_-20px_rgba(0,0,0,0.22),0_1px_2px_0_rgba(0,0,0,0.05)]">
        <HeadPeriodNavigator periods={periods} />

        <div className="flex min-w-[180px] flex-1 items-center justify-center gap-2">
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {departmentLabel}
          </span>
          <span className="text-[var(--color-muted-foreground)]">&middot;</span>
          <span className="text-sm text-[var(--color-muted-foreground)]">
            Live portfolio review
          </span>
        </div>
      </div>

      {/* Phase 31 (AI-01): executive summary card — appears above the
          assembled report, never overwrites head-authored narrative.
          Dismissible per session via local useState; head-only Regenerate. */}
      <AiSummaryCard reportId={view.period.reportId} />

      {/* Portfolio Overview */}
      <PortfolioOverviewTable products={portfolio} />

      {/* Per-product accordion sections */}
      <div className="space-y-3">
        {products.map((report) => (
          <ProductAccordion
            key={report.id}
            report={report}
            defaultOpen={focusedProductId === report.id}
            highlighted={focusedProductId === report.id}
            scrollIntoViewOnHighlight={scrollTargetProductId === report.id}
          />
        ))}
      </div>
    </div>
  );
}
