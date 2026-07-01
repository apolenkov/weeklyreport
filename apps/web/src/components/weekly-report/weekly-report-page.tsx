"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useContext, useEffect, useMemo } from "react";
import { toast } from "sonner";

import {
  invalidateDashboard,
  invalidateLeadForm,
  invalidateLeadHistory,
} from "../../lib/cache-keys";
import { getClientErrorDetails } from "../../lib/client-error-reporting";
import { joinPeriodLabel } from "../../lib/format-date";
import {
  type LeadOverviewRow,
  mapWeeklyReport,
  mapWeeklyReportLeadGroups,
  mapWeeklyReportLeadOverview,
} from "../../lib/mappers";
import { formatDateRange, isoWeekNumber } from "../../lib/mappers/lead-history";
import { reportHasContent } from "../../lib/mappers/report-content";
import { SessionContext } from "../../lib/session-provider";
import { useTRPC } from "../../lib/trpc-context";
import { useQueryErrorHandler } from "../../lib/use-query-error-handler";
import type { PortfolioProduct, ProductReport } from "../dashboard/mock-data";
import type { ReportPeriod } from "../lead/mock-data";
import { PdfExportComingSoonControl } from "../lead/pdf-export-coming-soon";
import { PeriodNavigator } from "../lead/period-navigator";
import {
  DocumentActionGroup,
  ReportToolbar,
} from "../report-shell/report-toolbar";
import { ExportPdfButton } from "./export-pdf-button";
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
  /**
   * report-toolbar-layout: the page owns the single two-row ReportToolbar. An
   * outer shell (HeadReportShell) supplies leading Document-action-row controls
   * here — head passes its labeled Export-PDF — rendered before the page's own
   * Move-to-archive / Publish lifecycle actions. When omitted the page renders
   * the shared Export control itself (head/admin/viewer get the real export;
   * lead sees the inert ComingSoon).
   */
  readonly documentActionsLeading?: ReactNode;
  /**
   * report-toolbar-layout: the FULL Context-control row (bottom row), composed
   * by an outer shell that owns a richer period navigator (HeadReportShell
   * prepends the active/displayed periods compiledHistory omits). When provided
   * it replaces the page's default context row, including period navigation.
   * Mutually exclusive with `contextControlsLeading`.
   */
  readonly contextControls?: ReactNode;
  /**
   * report-toolbar-layout: Context-control-row controls prepended before the
   * page's default period navigator. Used by standalone consumers (the viewer)
   * that reuse the page's own period nav but add the Agent-review placeholder
   * (leading edge) and Back-to-Archive navigation to the bottom row.
   */
  readonly contextControlsLeading?: ReactNode;
  /**
   * head-toolbar-parity D2: a context label (department name plus a short page
   * descriptor) rendered on the header line beside the title. It is a label,
   * not a control, so it stays out of the two action rows. Head form mode
   * passes it; standalone consumers omit it.
   */
  readonly headerContextLabel?: ReactNode;
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
 * Accordion body for the report page: a flat per-product list (default) or
 * products bucketed under each authoring lead ("by lead" head split-view).
 * Extracted so the page function stays under the cognitive-complexity budget.
 */
function ReportAccordionBody({
  scope,
  products,
  leadGroups,
  focusedProductId,
  scrollTargetProductId,
}: {
  readonly scope: "product" | "lead";
  readonly products: ProductReport[];
  readonly leadGroups: {
    id: string;
    name: string;
    products: ProductReport[];
  }[];
  readonly focusedProductId: string | undefined;
  readonly scrollTargetProductId: string | undefined;
}) {
  const renderAccordion = (report: ProductReport) => (
    <ProductAccordion
      key={report.id}
      report={report}
      defaultOpen={focusedProductId === report.id}
      highlighted={focusedProductId === report.id}
      scrollIntoViewOnHighlight={scrollTargetProductId === report.id}
    />
  );

  if (scope === "lead") {
    return (
      <div className="space-y-6">
        {leadGroups.map((group) => (
          // report-overview-scope-parity: stable anchor + focus target so a
          // by-lead overview card can scroll/focus this section (the by-lead
          // analogue of report-product-<id>).
          <section
            key={group.id}
            id={`report-lead-${group.id}`}
            tabIndex={-1}
            aria-label={group.name}
            className="space-y-3 scroll-mt-4 focus:outline-none"
          >
            <h3 className="font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-primary)]">
              {group.name}
            </h3>
            {group.products.map(renderAccordion)}
          </section>
        ))}
      </div>
    );
  }

  return <div className="space-y-3">{products.map(renderAccordion)}</div>;
}

/**
 * report-overview-scope-parity: the scope-adaptive Report overview band.
 * Extracted so the page function stays under the cognitive-complexity budget.
 * In by-lead scope it renders lead cards from `leadOverviewRows`; otherwise the
 * product cards from `portfolio`.
 */
function ReportOverviewBand({
  scope,
  portfolio,
  leadOverviewRows,
}: {
  readonly scope: "product" | "lead";
  readonly portfolio: PortfolioProduct[];
  readonly leadOverviewRows: LeadOverviewRow[];
}) {
  if (scope === "lead") {
    return <PortfolioOverviewTable scope="lead" leads={leadOverviewRows} />;
  }
  return <PortfolioOverviewTable products={portfolio} />;
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

/**
 * The single labeled Export-PDF control for the toolbar trailing group.
 * head/admin/viewer get the real button; lead gets the inert ComingSoon control
 * (lead is FORBIDDEN from pdfExport — W2). Extracted so the branching stays out
 * of WeeklyReportPage's body.
 */
function ToolbarExportControl({
  canExportPdf,
  showComingSoon,
  reportId,
  periodStatus,
}: {
  canExportPdf: boolean;
  showComingSoon: boolean;
  reportId: string;
  periodStatus: "open" | "published" | "reopened";
}) {
  if (canExportPdf) {
    return <ExportPdfButton reportId={reportId} periodStatus={periodStatus} />;
  }
  if (showComingSoon) {
    return <PdfExportComingSoonControl />;
  }
  return null;
}

export function WeeklyReportPage({
  reportId,
  redirectToCanonical,
  canonicalBasePath = "/head/report",
  authorId,
  scope = "product",
  documentActionsLeading,
  contextControls,
  contextControlsLeading,
  headerContextLabel,
}: WeeklyReportPageProps) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const router = useRouter();
  const focusedAuthorId = authorId ?? null;
  const sessionState = useContext(SessionContext);
  const currentRole = sessionState?.user?.role ?? null;
  const canMutatePeriod = currentRole === "head" || currentRole === "admin";
  // Export-PDF authz (fix-report-surface-integrity W2): head/admin/viewer get the
  // real export; lead is FORBIDDEN at the backend (pdfExport on leadershipProcedure)
  // and sees the inert ComingSoon control instead — never an active button that
  // would 403. The viewer's export is requester-scoped (their own published slice).
  const canExportPdf = currentRole !== null && currentRole !== "lead";
  const showLeadExportComingSoon = currentRole === "lead";

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
  // pendingCount mirrors mock semantics: total - submitted, clamped >= 0.
  const pendingCount = Math.max(0, total - submitted);

  // The mapper produces structurally compatible shapes; cast to the existing
  // mock-data presentation types so children keep their imports unchanged.
  const portfolio: PortfolioProduct[] = view.portfolio;
  const products: ProductReport[] = view.products;
  // Head split-view "by lead" grouping (report-card-clarity): slice each product
  // to the lead's OWN contribution — mapWeeklyReportLeadGroups builds per-lead
  // cards from each single section, drops empty leads, and is computed only in
  // "lead" scope (the default product path stays cheap). This replaced the old
  // bucketing that reused the cross-lead aggregate cards, which repeated the
  // whole merged card under every author of a multi-author product.
  const rawLeadGroups =
    scope === "lead" ? mapWeeklyReportLeadGroups(reportData) : [];
  const leadGroups = rawLeadGroups as {
    id: string;
    name: string;
    products: ProductReport[];
  }[];
  // report-overview-scope-parity: per-lead overview rows derived from the SAME
  // groups the body renders, so the summary band and the body agree 1:1.
  const leadOverviewRows = mapWeeklyReportLeadOverview(rawLeadGroups);

  const authoredProductIds = focusedAuthorId
    ? products
        .filter((report) => report.authorIds?.includes(focusedAuthorId))
        .map((report) => report.id)
    : [];
  const focusedProductId = focusedAuthorId
    ? products.find(
        (report) =>
          report.authorIds?.includes(focusedAuthorId) &&
          reportHasContent(report),
      )?.id
    : undefined;
  const hasExpandableProducts = products.some(reportHasContent);
  const canPublishReport = submitted > 0 && hasExpandableProducts;
  // head-toolbar-semantics: the publish precondition hint sits on the status
  // row, shown only to publish-capable roles while the period is unpublished
  // and has no submitted content to publish yet.
  const showPublishHint =
    canMutatePeriod &&
    !canPublishReport &&
    view.period.periodStatus !== "published";
  const archiveLabel = archiveMut.isPending ? "Archiving…" : "Archive";
  const scrollTargetProductId =
    authoredProductIds.length > 0 ? authoredProductIds[0] : undefined;
  // The standalone fallback navigator (when no shell-composed `toolbar` slot
  // arrives — e.g. the viewer /reports/[reportId] route) surfaces the active
  // period only; a single inert option. The shell-composed head toolbar
  // supplies the full multi-period combobox via the `toolbar` slot.
  const periods: ReportPeriod[] = [
    {
      id: view.period.id,
      sourceSectionId: "",
      weekLabel: view.period.weekLabel,
      dateRange: view.period.dateRange,
      isCurrent: view.period.isCurrent,
      isSubmitted: true,
    },
  ];
  const periodLabel = joinPeriodLabel(
    view.period.weekLabel,
    view.period.dateRange,
  );

  return (
    <div className="space-y-4">
      {/* Page header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            Status Report
          </h1>
          <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
            Live &middot; {submitted}/{total} Submitted
          </span>
          {/* head-toolbar-semantics: the publish precondition hint sits on the
              report-status row (not the action row). */}
          {showPublishHint && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Publish requires at least one submitted section.
            </span>
          )}
          {/* head-toolbar-parity D2: department context label — a label, not a
              control, so it stays on the header line, out of the action rows. */}
          {headerContextLabel}
        </div>
        {/* report-toolbar-layout: document actions live on the header line's
            right slot, not inside the bordered toolbar. The labeled Export-PDF
            (or a shell-supplied leading action) leads, then the head lifecycle
            actions (Move-to-archive, Publish & Lock). Viewer and the lead
            preview have no mutating actions, so only the export control renders. */}
        <DocumentActionGroup>
          {documentActionsLeading ?? (
            <ToolbarExportControl
              canExportPdf={canExportPdf}
              showComingSoon={showLeadExportComingSoon}
              reportId={view.period.reportId}
              periodStatus={view.period.periodStatus}
            />
          )}
          {/* A22: Move-to-archive — a published-period lifecycle action, so it
              is a document action (neutral/outline), distinct from the
              show-archived filter in the context bar. Hidden after archiving
              because this page only navigates active periods. */}
          {canMutatePeriod && view.period.periodStatus === "published" && (
            <button
              type="button"
              className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() =>
                archiveMut.mutate({ reportId: view.period.reportId })
              }
              disabled={archiveMut.isPending}
              aria-label="Move this report to the archive"
            >
              {archiveLabel}
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
              publishDisabledReason="Publish requires at least one submitted section."
            />
          )}
        </DocumentActionGroup>
      </header>

      {/* report-toolbar-layout: the bordered toolbar holds only the
          Context-control bar — either a shell-composed row (head) or the page's
          default period navigator, optionally preceded by leading controls
          (the viewer's Agent review). */}
      <ReportToolbar
        contextControls={
          contextControls ?? (
            <>
              {contextControlsLeading}
              <PeriodNavigator
                periods={periods}
                urlBuilder={(periodId) =>
                  `/head/report/${encodeURIComponent(periodId)}`
                }
              />
            </>
          )
        }
      />

      {/* A32 + head-report-visibility: empty-state — only when the report has
          NO section content at all (not merely zero submissions). The head sees
          live draft content regardless of submission, so the gate keys off
          `hasExpandableProducts` (any item/risk/decision/priority across
          sections), never `submitted === 0`. Keeps header + period nav intact so
          the head retains context. */}
      {!hasExpandableProducts && view.period.periodStatus !== "published" ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-empty)] py-16 text-center"
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
          {/* Report overview — scope-adaptive (report-overview-scope-parity). */}
          <ReportOverviewBand
            scope={scope}
            portfolio={portfolio}
            leadOverviewRows={leadOverviewRows}
          />

          {/* Accordion sections — by product (default) or grouped by lead */}
          <ReportAccordionBody
            scope={scope}
            products={products}
            leadGroups={leadGroups}
            focusedProductId={focusedProductId}
            scrollTargetProductId={scrollTargetProductId}
          />
        </>
      )}
    </div>
  );
}
