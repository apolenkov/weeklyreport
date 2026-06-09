"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useMemo } from "react";
import { toast } from "sonner";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../lib/cache-keys";
import {
  formatClientErrorMessage,
  logClientError,
} from "../../lib/client-error-reporting";
import { joinPeriodLabel } from "../../lib/format-date";
import { mapWeeklyReport } from "../../lib/mappers";
import { formatDateRange, isoWeekNumber } from "../../lib/mappers/lead-history";
import { SessionContext } from "../../lib/session-provider";
import { useTRPC } from "../../lib/trpc-context";
import type {
  PortfolioProduct,
  ProductReport,
  ReportPeriod,
} from "../dashboard/mock-data";
import { ExportPdfButton } from "./export-pdf-button";
import { HeadPeriodNavigator } from "./period-navigator";
import { PortfolioOverviewTable } from "./portfolio-overview-table";
import { ProductAccordion } from "./product-accordion";
import { PublishLockButton } from "./publish-lock-button";
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
}

export function WeeklyReportPage({
  reportId,
  redirectToCanonical,
  canonicalBasePath = "/head/report",
  authorId,
  scope = "product",
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
  const currentRole = sessionState?.user?.role ?? null;
  const canMutatePeriod = currentRole === "head" || currentRole === "admin";

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

  // A22: archive mutation — head moves a published report into the archive so
  // it appears in archive.list. Only visible when periodStatus==='published'.
  const archiveMut = useMutation(
    trpc.archive.archiveReport.mutationOptions({
      onSuccess: () => {
        invalidateDashboard(qc, trpc);
        toast.success("Report archived");
      },
      onError: (err: unknown) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to archive report",
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
        authorId: focusedAuthorId,
      });
      toast.error(
        formatClientErrorMessage("Failed to load status report", weeklyQ.error),
      );
    }
  }, [weeklyQ.isError, weeklyQ.error, reportId, focusedAuthorId]);

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

  // R3a: no active period — show empty state instead of error toast / spinner.
  if (!weeklyQ.data || weeklyQ.data.status === "no-period") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-lg font-semibold text-[var(--color-foreground)]">
          No active reporting period
        </p>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          Ask an admin to open a new period to start collecting status reports.
        </p>
      </div>
    );
  }

  const view = mapWeeklyReport(weeklyQ.data);
  const submitted = view.submissionCount;
  const total = view.totalLeads;
  // pendingCount mirrors mock semantics: total - submitted, clamped >= 0.
  const pendingCount = Math.max(0, total - submitted);

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
          for (const section of weeklyQ.data.leadSections) {
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
        <div className="flex items-center gap-3">
          {/* The async export starts a `pdfExport.request` job, which the API
              gates to head/admin (headProcedure). Match the button's visibility
              to that authz so viewers/leads are not shown a control that 403s
              (driver sweep 2026-06-09). The read-only /reports/[reportId] route
              still offers a plain /print link for every role. */}
          {canMutatePeriod && (
            <ExportPdfButton
              reportId={view.period.reportId}
              periodStatus={view.period.periodStatus}
            />
          )}
          {/* A22: "Archive" button — shown to head once the period is published.
              Moves the report into the archive (sets archived=true) so it
              appears in the Archive tab. The button is hidden after archiving
              because this page only navigates to current/active periods. */}
          {canMutatePeriod && view.period.periodStatus === "published" && (
            <button
              type="button"
              className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() =>
                archiveMut.mutate({ reportId: view.period.reportId })
              }
              disabled={archiveMut.isPending}
              aria-label="Move this report to the archive"
            >
              {archiveMut.isPending ? "Archiving…" : "Archive"}
            </button>
          )}
          {canMutatePeriod && (
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
          )}
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
