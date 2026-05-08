"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

export function DashboardPage() {
  const trpc = useTRPC();
  const [toggleAllAction, setToggleAllAction] = useState<"collapse" | "expand">(
    "collapse",
  );

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

  useEffect(() => {
    if (!isLoading) scheduleToggleAllSync();
  }, [isLoading, scheduleToggleAllSync]);

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
