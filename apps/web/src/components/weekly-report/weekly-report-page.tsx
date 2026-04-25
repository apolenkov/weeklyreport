'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../lib/trpc-context';
import { mapWeeklyReport } from '../../lib/mappers';
import type {
  PortfolioProduct,
  ProductReport,
  ReportPeriod,
} from '../dashboard/mock-data';

import { HeadPeriodNavigator } from './period-navigator';
import { PortfolioOverviewTable } from './portfolio-overview-table';
import { ProductAccordion } from './product-accordion';
import { PublishLockButton } from './publish-lock-button';
import { ExportPdfButton } from './export-pdf-button';
import { WeeklyReportSkeleton } from './weekly-report-skeleton';

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
};

function CollapseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      fill="none"
      strokeWidth={2}
    >
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );
}

export function WeeklyReportPage({ period: _period, reportId }: WeeklyReportPageProps) {
  const trpc = useTRPC();

  // weeklyReport.get input: { reportId?: string } | undefined.
  // When reportId is given, scope to that report; otherwise fall back to the
  // session's active period (server-side default).
  const queryInput = reportId ? { reportId } : {};
  const weeklyQ = useQuery(trpc.weeklyReport.get.queryOptions(queryInput));

  useEffect(() => {
    if (weeklyQ.isError) {
      toast.error(
        weeklyQ.error instanceof Error
          ? `Failed to load weekly report: ${weeklyQ.error.message}`
          : 'Failed to load weekly report',
      );
    }
  }, [weeklyQ.isError, weeklyQ.error]);

  function handleToggleAll() {
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      '[aria-expanded]',
    );
    const anyExpanded = Array.from(buttons).some(
      (btn) => btn.getAttribute('aria-expanded') === 'true',
    );
    buttons.forEach((btn) => {
      if (
        (anyExpanded && btn.getAttribute('aria-expanded') === 'true') ||
        (!anyExpanded && btn.getAttribute('aria-expanded') === 'false')
      ) {
        btn.click();
      }
    });
  }

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
            Weekly Report
          </h1>
          <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
            Live &middot; {submitted}/{total} Submitted
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[rgba(0,0,0,0.2)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-foreground)] transition-colors hover:bg-[#f8f6f2]"
            onClick={handleToggleAll}
            title="Toggle All"
          >
            <CollapseIcon />
            Toggle All
          </button>
          {/* TODO(Phase 22): wire pdfExport.request mutation for ExportPdfButton onExport */}
          <ExportPdfButton />
          {/* TODO(Phase 22): wire period.publish mutation for PublishLockButton onPublish */}
          <PublishLockButton pendingCount={pendingCount} totalLeads={total} />
        </div>
      </div>

      {/* Context shell: Period nav + department */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.78)_100%)] px-4 py-3.5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.06),0_10px_24px_-20px_rgba(0,0,0,0.22),0_1px_2px_0_rgba(0,0,0,0.05)]">
        <HeadPeriodNavigator periods={periods} />

        <div className="flex min-w-[180px] flex-1 items-center justify-center gap-2">
          <span className="text-sm text-[var(--color-muted-foreground)]">CoreDev Department</span>
          <span className="text-[var(--color-muted-foreground)]">&middot;</span>
          <span className="text-sm text-[var(--color-muted-foreground)]">Live portfolio review</span>
        </div>
      </div>

      {/* Portfolio Overview */}
      <PortfolioOverviewTable products={portfolio} />

      {/* Per-product accordion sections */}
      <div className="space-y-3">
        {products.map((report) => (
          <ProductAccordion
            key={report.id}
            report={report}
            defaultOpen={false}
          />
        ))}
      </div>
    </div>
  );
}
