"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmationDialog } from "../../../components/ui/confirmation-dialog";
import { toSectionReviewRows } from "../../../components/weekly-report/review/section-review-rows";
import { SectionReviewStrip } from "../../../components/weekly-report/review/section-review-strip";
import {
  formatClientErrorMessage,
  logClientError,
} from "../../../lib/client-error-reporting";
import { mapDashboardData } from "../../../lib/mappers";
import { SessionContext } from "../../../lib/session-provider";
import { useTRPC } from "../../../lib/trpc-context";
import { useQueryErrorHandler } from "../../../lib/use-query-error-handler";
import { ActivityLivePanel } from "./activity-live-panel";
import { AlertBar } from "./alert-bar";
import { BlockedAtRiskTable } from "./blocked-at-risk-table";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { KpiCards } from "./kpi-cards";
import { LeadSummaryTable } from "./lead-summary-table";
import { ReopenRequestsCard } from "./reopen-requests-card";

export const DASHBOARD_LOAD_STALL_MS = 8000;

export function DashboardPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [loadStalled, setLoadStalled] = useState(false);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);
  // UFB-047 / Phase 49-01: brand label sourced from `auth.me.organization`
  // (the singleton's `fullName`). Replaces the legacy
  // `weeklyReport.get.departmentName` field that was dropped with the column.
  const sessionState = useContext(SessionContext);
  const orgFullName = sessionState?.organization?.fullName ?? null;

  // Perf (Vercel audit 2026-05-22): both are expensive portfolio aggregations;
  // a 60s staleTime avoids redundant refetches on remount/focus vs the 30s
  // global default. Shared query keys keep React Query dedup intact.
  const reviewQ = useQuery({
    ...trpc.review.dashboard.queryOptions(),
    staleTime: 60_000,
  });
  const weeklyQ = useQuery({
    ...trpc.weeklyReport.get.queryOptions({}),
    staleTime: 60_000,
  });

  const revokeAllMutation = useMutation(
    trpc.leadForm.revokeAllSubmitted.mutationOptions({
      onSuccess: (result) => {
        toast.success(
          `${result.revokedCount} submission${result.revokedCount === 1 ? "" : "s"} revoked.`,
        );
        void queryClient.invalidateQueries(
          trpc.weeklyReport.get.queryOptions({}),
        );
      },
      onError: (err) => {
        toast.error(`Revoke All failed: ${err.message}`);
      },
    }),
  );

  useQueryErrorHandler(reviewQ, {
    event: "dashboard.review.load_failed",
    component: "DashboardPage",
    procedure: "review.dashboard",
    toastPrefix: "Failed to load dashboard",
  });

  useQueryErrorHandler(weeklyQ, {
    event: "dashboard.weeklyReport.load_failed",
    component: "DashboardPage",
    procedure: "weeklyReport.get",
    context: { reportId: null },
    toastPrefix: "Failed to load status report",
  });

  const isLoading = reviewQ.isLoading || weeklyQ.isLoading;
  const queryError = reviewQ.error ?? weeklyQ.error;
  const hasDashboardData =
    reviewQ.data !== undefined && weeklyQ.data !== undefined;
  const reviewRefetch = reviewQ.refetch;
  const weeklyRefetch = weeklyQ.refetch;
  const reviewStatus = reviewQ.status;
  const weeklyStatus = weeklyQ.status;
  const reviewFetchStatus = reviewQ.fetchStatus;
  const weeklyFetchStatus = weeklyQ.fetchStatus;

  const refetchDashboardQueries = useCallback(
    (resetStalled: boolean) => {
      if (resetStalled) setLoadStalled(false);
      void Promise.allSettled([reviewRefetch(), weeklyRefetch()]);
    },
    [reviewRefetch, weeklyRefetch],
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
      weeklyStatus,
      weeklyFetchStatus,
    });
  }, [reviewFetchStatus, reviewStatus, weeklyFetchStatus, weeklyStatus]);

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
        weeklyStatus,
        weeklyFetchStatus,
      });
      markStalledAndRefetch();
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [
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

  if (queryError) {
    return (
      <DashboardLoadIssue
        title="Could not load dashboard"
        description={formatClientErrorMessage(
          "One of the dashboard data requests failed",
          queryError,
        )}
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

  // R3a: no active period — show empty state instead of error toast / spinner.
  // weeklyQ.data.status === 'no-period' is a normal 200, never an error.
  if (weeklyQ.data.status === "no-period") {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            Dashboard
          </h1>
        </header>
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)]">
          <p className="text-lg font-semibold text-[var(--color-foreground)]">
            No active reporting period
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Ask an admin to open a new period to start collecting status
            reports.
          </p>
        </div>
      </div>
    );
  }

  const dashboard = mapDashboardData({
    review: reviewQ.data,
    archive: { items: [], nextCursor: null },
    weeklyReport: weeklyQ.data,
  });
  const { kpi, leads, blockedAtRisk, pendingLeads } = dashboard;
  // Section-reviews roll-up: the head's at-a-glance verdict state for every
  // section, relocated here from the report body. A verdict may un-submit a
  // section, so refresh the dashboard's own queries on mutation.
  const sectionReviewRows = toSectionReviewRows(weeklyQ.data.leadSections);
  // UFB-047 / Phase 49-01: see `orgFullName` above.
  const departmentLabel = orgFullName ?? "CustomReport";
  const canSendReminder =
    weeklyQ.data.periodStatus !== "published" &&
    weeklyQ.data.hasActiveReminderRule;
  const submittedCount = leads.filter((l) => l.status === "submitted").length;
  const activeReportId = weeklyQ.data.reportId;
  const canRevokeAll =
    weeklyQ.data.periodStatus !== "published" && submittedCount > 0;

  return (
    <div className="space-y-6">
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
          {/* SC-165: Revoke All submitted leads at once */}
          {canRevokeAll && (
            <button
              type="button"
              onClick={() => setRevokeAllOpen(true)}
              disabled={revokeAllMutation.isPending}
              aria-busy={revokeAllMutation.isPending}
              data-testid="revoke-all-button"
              className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1.5 rounded-[var(--radius-pill)] border border-red-300 bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-default disabled:opacity-60"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Revoke All ({submittedCount})
            </button>
          )}
          {/* head-surface-uat-polish (UAT 2026-06-24): the "View Status Report"
              link was removed — it pointed at the current period, the same
              destination as the always-present "Status" nav tab, so it was a
              redundant duplicate. */}
        </div>
      </header>

      {/* SC-165: Revoke All confirm dialog */}
      <ConfirmationDialog
        open={revokeAllOpen}
        onClose={() => setRevokeAllOpen(false)}
        onConfirm={() => {
          setRevokeAllOpen(false);
          revokeAllMutation.mutate({ reportId: activeReportId });
        }}
        title="Revoke All Submissions?"
        description={`Revoke all ${submittedCount} submitted lead${submittedCount === 1 ? "" : "s"}? Their forms return to Draft status.`}
        confirmLabel={`Revoke ${submittedCount} Submission${submittedCount === 1 ? "" : "s"}`}
        variant="revoke"
      />

      {/* UX-18 (Phase 35-08): live activity feed at the top of the
          dashboard so head/admin sees who's already filed and who hasn't
          without drilling into every section. */}
      <ActivityLivePanel />

      {/* KPI Cards */}
      <KpiCards data={kpi} />

      {/* D-29: head/admin need the per-lead submission table on the dashboard,
          not only the aggregate cards and alert row. */}
      <LeadSummaryTable
        leads={leads}
        reportId={weeklyQ.data.reportId}
        canSendReminder={canSendReminder}
      />

      {/* Alert bar for pending leads + pending reopen requests */}
      <AlertBar
        pendingLeads={pendingLeads}
        reportId={weeklyQ.data.reportId}
        canSendReminder={canSendReminder}
      />

      {/* Section-reviews roll-up: per-section verdict state for the whole
          period, merged into the dashboard review area (relocated from the
          report body). Self-suppresses when nothing is reviewable. */}
      <SectionReviewStrip
        sections={sectionReviewRows}
        onMutated={() => refetchDashboardQueries(false)}
      />

      {/* reopen-request-lifecycle (D2): head-side queue of pending reopen
          requests with inline approve/reject. Renders nothing when the queue
          is empty. */}
      <ReopenRequestsCard />

      {/* Blocked & At Risk */}
      <BlockedAtRiskTable items={blockedAtRisk} />
    </div>
  );
}

interface DashboardLoadIssueProps {
  title: string;
  description: string;
  onRetry: () => void;
}

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
        className="flex max-w-2xl flex-col gap-4 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm"
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
          className="btn-press inline-flex min-h-[var(--touch-target-min)] w-fit cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-4 py-2 font-[family-name:var(--font-sans)] text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-starbucks-accent)]"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Retry
        </button>
      </section>
    </div>
  );
}
