"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "../../lib/trpc-context";
import { mapDashboardData } from "../../lib/mappers";
import { logClientError } from "../../lib/client-error-reporting";

import { KpiCards } from "./kpi-cards";
import { AlertBar } from "./alert-bar";
import { BlockedAtRiskTable } from "./blocked-at-risk-table";
import { LeadReportsGrid } from "./lead-reports-grid";
import { ReportArchiveSection } from "./report-archive-section";
import { ToggleAllButton } from "./toggle-all-button";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { ActivityLivePanel } from "./activity-live-panel";

export const DASHBOARD_LOAD_STALL_MS = 8_000;

export function DashboardPage() {
  const trpc = useTRPC();
  const [toggleAllAction, setToggleAllAction] = useState<"collapse" | "expand">(
    "collapse",
  );
  const [loadStalled, setLoadStalled] = useState(false);

  const reviewQ = useQuery(trpc.review.dashboard.queryOptions());
  const archiveQ = useQuery(trpc.archive.list.queryOptions({ limit: 12 }));
  const weeklyQ = useQuery(trpc.weeklyReport.get.queryOptions({}));

  useEffect(() => {
    if (reviewQ.isError) {
      logClientError("dashboard.review.load_failed", reviewQ.error, {
        component: "DashboardPage",
        procedure: "review.dashboard",
      });
      toast.error(
        reviewQ.error instanceof Error
          ? `Failed to load dashboard: ${reviewQ.error.message}`
          : "Failed to load dashboard",
      );
    }
  }, [reviewQ.isError, reviewQ.error]);

  useEffect(() => {
    if (archiveQ.isError) {
      logClientError("dashboard.archive.load_failed", archiveQ.error, {
        component: "DashboardPage",
        procedure: "archive.list",
        limit: 12,
      });
      toast.error(
        archiveQ.error instanceof Error
          ? `Failed to load archive: ${archiveQ.error.message}`
          : "Failed to load archive",
      );
    }
  }, [archiveQ.isError, archiveQ.error]);

  useEffect(() => {
    if (weeklyQ.isError) {
      logClientError("dashboard.weeklyReport.load_failed", weeklyQ.error, {
        component: "DashboardPage",
        procedure: "weeklyReport.get",
        reportId: null,
      });
      toast.error(
        weeklyQ.error instanceof Error
          ? `Failed to load weekly report: ${weeklyQ.error.message}`
          : "Failed to load weekly report",
      );
    }
  }, [weeklyQ.isError, weeklyQ.error]);

  const sectionsRef = useRef<HTMLDivElement | null>(null);

  const getAccordionButtons = useCallback(() => {
    const root = sectionsRef.current;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLButtonElement>("[aria-expanded]"),
    );
  }, []);

  const syncToggleAllAction = useCallback(() => {
    const anyExpanded = getAccordionButtons().some(
      (btn) => btn.getAttribute("aria-expanded") === "true",
    );
    setToggleAllAction(anyExpanded ? "collapse" : "expand");
  }, [getAccordionButtons]);

  const scheduleToggleAllSync = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(syncToggleAllAction);
    });
  }, [syncToggleAllAction]);

  function handleToggleAll() {
    // Scope to dashboard sections — global selector matched the nav drawer
    // trigger and any other page-level accordion controls.
    const buttons = getAccordionButtons();
    const anyExpanded = buttons.some(
      (btn) => btn.getAttribute("aria-expanded") === "true",
    );
    buttons.forEach((btn) => {
      if (
        (anyExpanded && btn.getAttribute("aria-expanded") === "true") ||
        (!anyExpanded && btn.getAttribute("aria-expanded") === "false")
      ) {
        btn.click();
      }
    });
    setToggleAllAction(anyExpanded ? "expand" : "collapse");
  }

  const isLoading =
    reviewQ.isLoading || archiveQ.isLoading || weeklyQ.isLoading;
  const queryError = reviewQ.error ?? archiveQ.error ?? weeklyQ.error;
  const hasDashboardData =
    reviewQ.data !== undefined &&
    archiveQ.data !== undefined &&
    weeklyQ.data !== undefined;
  const reviewRefetch = reviewQ.refetch;
  const archiveRefetch = archiveQ.refetch;
  const weeklyRefetch = weeklyQ.refetch;
  const reviewStatus = reviewQ.status;
  const archiveStatus = archiveQ.status;
  const weeklyStatus = weeklyQ.status;
  const reviewFetchStatus = reviewQ.fetchStatus;
  const archiveFetchStatus = archiveQ.fetchStatus;
  const weeklyFetchStatus = weeklyQ.fetchStatus;

  const refetchDashboardQueries = useCallback(
    (resetStalled: boolean) => {
      if (resetStalled) setLoadStalled(false);
      void Promise.allSettled([
        reviewRefetch(),
        archiveRefetch(),
        weeklyRefetch(),
      ]);
    },
    [archiveRefetch, reviewRefetch, weeklyRefetch],
  );

  const retryDashboardLoad = useCallback(() => {
    refetchDashboardQueries(true);
  }, [refetchDashboardQueries]);

  const markStalledAndRefetch = useCallback(() => {
    setLoadStalled(true);
    refetchDashboardQueries(false);
  }, [refetchDashboardQueries]);

  const logDashboardStall = useCallback(() => {
    const error = new Error(
      `Dashboard data did not settle within ${DASHBOARD_LOAD_STALL_MS}ms`,
    );
    logClientError("dashboard.load_stalled", error, {
      component: "DashboardPage",
      path: window.location.pathname,
      reviewStatus,
      reviewFetchStatus,
      archiveStatus,
      archiveFetchStatus,
      weeklyStatus,
      weeklyFetchStatus,
    });
  }, [
    archiveFetchStatus,
    archiveStatus,
    reviewFetchStatus,
    reviewStatus,
    weeklyFetchStatus,
    weeklyStatus,
  ]);

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      const navigation = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      const isHistoryRestore =
        event.persisted || navigation?.type === "back_forward";
      if (!isHistoryRestore) return;

      if (hasDashboardData) {
        refetchDashboardQueries(false);
        return;
      }

      const error = new Error(
        "Dashboard restored from browser history before data settled",
      );
      logClientError("dashboard.pageshow_missing_data", error, {
        component: "DashboardPage",
        path: window.location.pathname,
        reviewStatus,
        reviewFetchStatus,
        archiveStatus,
        archiveFetchStatus,
        weeklyStatus,
        weeklyFetchStatus,
      });
      markStalledAndRefetch();
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [
    archiveFetchStatus,
    archiveStatus,
    hasDashboardData,
    markStalledAndRefetch,
    refetchDashboardQueries,
    reviewFetchStatus,
    reviewStatus,
    weeklyFetchStatus,
    weeklyStatus,
  ]);

  useEffect(() => {
    if (hasDashboardData || queryError) {
      setLoadStalled(false);
      return;
    }

    const timer = window.setTimeout(() => {
      logDashboardStall();
      markStalledAndRefetch();
    }, DASHBOARD_LOAD_STALL_MS);

    return () => window.clearTimeout(timer);
  }, [hasDashboardData, queryError, logDashboardStall, markStalledAndRefetch]);

  useEffect(() => {
    if (!isLoading) scheduleToggleAllSync();
  }, [isLoading, scheduleToggleAllSync]);

  if (queryError) {
    return (
      <DashboardLoadIssue
        title="Could not load dashboard"
        description={
          queryError instanceof Error
            ? queryError.message
            : "One of the dashboard data requests failed."
        }
        onRetry={retryDashboardLoad}
      />
    );
  }

  if (!hasDashboardData && loadStalled) {
    return (
      <DashboardLoadIssue
        title="Dashboard is still loading"
        description="One or more dashboard requests did not finish. The page is retrying now."
        onRetry={retryDashboardLoad}
      />
    );
  }

  if (isLoading || !hasDashboardData) {
    return (
      <div className="space-y-6" data-dashboard-loading="true">
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
  const departmentLabel = weeklyQ.data.departmentName;

  return (
    <div
      className="space-y-6"
      ref={sectionsRef}
      onClickCapture={scheduleToggleAllSync}
    >
      {/* Page header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            Dashboard
          </h1>
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {weeklyQ.data.weekLabel ?? "Current period"} &middot;{" "}
            {departmentLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleAllButton
            action={toggleAllAction}
            onToggle={handleToggleAll}
          />
          <a
            href={`/head/report/${encodeURIComponent(weeklyQ.data.reportId)}`}
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
      <ReportArchiveSection currentReportId={weeklyQ.data.reportId} />
    </div>
  );
}

type DashboardLoadIssueProps = {
  title: string;
  description: string;
  onRetry: () => void;
};

function DashboardLoadIssue({
  title,
  description,
  onRetry,
}: DashboardLoadIssueProps) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
          Dashboard
        </h1>
      </header>
      <section
        className="flex max-w-2xl flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            aria-hidden="true"
            className="mt-1 h-5 w-5 shrink-0 text-[var(--color-warning)]"
          />
          <div className="space-y-1">
            <h2 className="font-[family-name:var(--font-sans)] text-lg font-semibold text-[var(--color-foreground)]">
              {title}
            </h2>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {description}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="btn-press inline-flex min-h-[var(--touch-target-min)] w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-surface)] transition-colors hover:bg-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-starbucks-accent)]"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Retry
        </button>
      </section>
    </div>
  );
}
