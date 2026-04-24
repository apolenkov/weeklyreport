'use client';

import { KpiCards } from './kpi-cards';
import { AlertBar } from './alert-bar';
import { BlockedAtRiskTable } from './blocked-at-risk-table';
import { LeadReportsGrid } from './lead-reports-grid';
import { ReportArchiveSection } from './report-archive-section';
import { ToggleAllButton } from './toggle-all-button';
import {
  MOCK_KPI,
  MOCK_LEADS,
  MOCK_BLOCKED_AT_RISK,
  MOCK_ARCHIVE,
  MOCK_PENDING_LEADS,
} from './mock-data';

export function DashboardPage() {
  function handleToggleAll() {
    // Toggle all accordion sections on the page
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
    <div className="space-y-6">
      {/* Page header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            Dashboard
          </h1>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            Apr 14 &ndash; Apr 20, 2026 &middot; Week 16 &middot; Development
            Department
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleAllButton onToggle={handleToggleAll} />
          <a
            href="/head/report"
            className="btn-press inline-flex min-h-[44px] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
          >
            View Weekly Report
          </a>
        </div>
      </header>

      {/* KPI Cards */}
      <KpiCards data={MOCK_KPI} />

      {/* Alert bar for pending leads */}
      <AlertBar pendingLeads={MOCK_PENDING_LEADS} />

      {/* Blocked & At Risk */}
      <BlockedAtRiskTable items={MOCK_BLOCKED_AT_RISK} />

      {/* Lead Reports */}
      <LeadReportsGrid leads={MOCK_LEADS} />

      {/* Report Archive */}
      <ReportArchiveSection reports={MOCK_ARCHIVE} totalCount={12} />
    </div>
  );
}
