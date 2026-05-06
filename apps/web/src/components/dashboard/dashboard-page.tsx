'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '../../lib/trpc-context';
import { mapDashboardData } from '../../lib/mappers';

import { KpiCards } from './kpi-cards';
import { AlertBar } from './alert-bar';
import { BlockedAtRiskTable } from './blocked-at-risk-table';
import { LeadReportsGrid } from './lead-reports-grid';
import { ReportArchiveSection } from './report-archive-section';
import { ToggleAllButton } from './toggle-all-button';
import { DashboardSkeleton } from './dashboard-skeleton';
import { ActivityLivePanel } from './activity-live-panel';

export function DashboardPage() {
  const trpc = useTRPC();

  const reviewQ = useQuery(trpc.review.dashboard.queryOptions());
  const archiveQ = useQuery(trpc.archive.list.queryOptions({ limit: 12 }));
  const weeklyQ = useQuery(trpc.weeklyReport.get.queryOptions({}));

  useEffect(() => {
    if (reviewQ.isError) {
      toast.error(
        reviewQ.error instanceof Error
          ? `Failed to load dashboard: ${reviewQ.error.message}`
          : 'Failed to load dashboard',
      );
    }
  }, [reviewQ.isError, reviewQ.error]);

  useEffect(() => {
    if (archiveQ.isError) {
      toast.error(
        archiveQ.error instanceof Error
          ? `Failed to load archive: ${archiveQ.error.message}`
          : 'Failed to load archive',
      );
    }
  }, [archiveQ.isError, archiveQ.error]);

  useEffect(() => {
    if (weeklyQ.isError) {
      toast.error(
        weeklyQ.error instanceof Error
          ? `Failed to load weekly report: ${weeklyQ.error.message}`
          : 'Failed to load weekly report',
      );
    }
  }, [weeklyQ.isError, weeklyQ.error]);

  const sectionsRef = useRef<HTMLDivElement | null>(null);

  function handleToggleAll() {
    // Scope to dashboard sections — global selector matched the nav drawer
    // trigger and any other page-level accordion controls.
    const root = sectionsRef.current;
    if (!root) return;
    const buttons = root.querySelectorAll<HTMLButtonElement>('[aria-expanded]');
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

  const isLoading = reviewQ.isLoading || archiveQ.isLoading || weeklyQ.isLoading;

  if (isLoading || !reviewQ.data || !archiveQ.data || !weeklyQ.data) {
    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
              Dashboard
            </h1>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Loading current period &hellip;
            </p>
          </div>
        </header>
        <DashboardSkeleton />
      </div>
    );
  }

  const dashboard = mapDashboardData({
    review: reviewQ.data,
    archive: archiveQ.data,
    weeklyReport: weeklyQ.data,
  });
  const { kpi, leads, blockedAtRisk, pendingLeads } = dashboard;

  return (
    <div className="space-y-6" ref={sectionsRef}>
      {/* Page header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            Dashboard
          </h1>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {weeklyQ.data.weekLabel ?? 'Current period'} &middot; Development Department
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleAllButton onToggle={handleToggleAll} />
          <a
            href="/head/report"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-starbucks-accent)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-starbucks-accent)] transition-colors hover:bg-[var(--color-success)]"
          >
            View Weekly Report
          </a>
        </div>
      </header>

      {/* UX-18 (Phase 35-08): live activity feed at the top of the
          dashboard so head/admin sees who's already filed and who hasn't
          without drilling into every section. */}
      <ActivityLivePanel />

      {/* KPI Cards */}
      <KpiCards data={kpi} />

      {/* Alert bar for pending leads */}
      <AlertBar pendingLeads={pendingLeads} reportId={weeklyQ.data.reportId} />

      {/* Blocked & At Risk */}
      <BlockedAtRiskTable items={blockedAtRisk} />

      {/* Lead Reports */}
      <LeadReportsGrid leads={leads} />

      {/* Report Archive — self-contained: owns its own cursor pagination */}
      <ReportArchiveSection />
    </div>
  );
}
