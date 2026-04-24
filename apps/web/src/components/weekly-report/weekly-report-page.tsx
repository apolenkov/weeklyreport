'use client';

import { Suspense } from 'react';

import { HeadPeriodNavigator } from './period-navigator';
import { PortfolioOverviewTable } from './portfolio-overview-table';
import { ProductAccordion } from './product-accordion';
import { PublishLockButton } from './publish-lock-button';
import { ExportPdfButton } from './export-pdf-button';
import {
  MOCK_REPORT_PERIODS,
  MOCK_PORTFOLIO,
  MOCK_PRODUCT_REPORTS,
  MOCK_KPI,
} from '../dashboard/mock-data';

type WeeklyReportPageProps = {
  readonly period?: string;
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

export function WeeklyReportPage({ period }: WeeklyReportPageProps) {
  const submitted = MOCK_KPI.submitted;
  const total = MOCK_KPI.total;
  const pendingCount = MOCK_KPI.pendingCount;

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
          <ExportPdfButton />
          <PublishLockButton pendingCount={pendingCount} totalLeads={total} />
        </div>
      </div>

      {/* Context shell: Period nav + department */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.78)_100%)] px-4 py-3.5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.06),0_10px_24px_-20px_rgba(0,0,0,0.22),0_1px_2px_0_rgba(0,0,0,0.05)]">
        <Suspense fallback={<div className="h-11 w-60 animate-pulse rounded-lg bg-[var(--color-skeleton)]" />}>
          <HeadPeriodNavigator periods={MOCK_REPORT_PERIODS} />
        </Suspense>

        <div className="flex min-w-[180px] flex-1 items-center justify-center gap-2">
          <span className="text-sm text-[var(--color-muted-foreground)]">Development Department</span>
          <span className="text-[var(--color-muted-foreground)]">&middot;</span>
          <span className="text-sm text-[var(--color-muted-foreground)]">Live portfolio review</span>
        </div>
      </div>

      {/* Portfolio Overview */}
      <PortfolioOverviewTable products={MOCK_PORTFOLIO} />

      {/* Per-product accordion sections */}
      <div className="space-y-3">
        {MOCK_PRODUCT_REPORTS.map((report) => (
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
