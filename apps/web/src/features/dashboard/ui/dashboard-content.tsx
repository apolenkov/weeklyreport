"use client";

import type {
  ActivityLiveResponse,
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@customreport/shared";

import {
  mapReviewDashboardData,
  mapWeeklyDashboardData,
} from "../model/dashboard";
import { AlertBar } from "./alert-bar";
import { BlockedAtRiskTable } from "./blocked-at-risk-table";
import { DashboardRevokeAllControl } from "./dashboard-revoke-all-control";
import {
  DashboardActivityIssue,
  DashboardReviewIssue,
  DashboardSourceSlot,
  type DashboardSourceState,
} from "./dashboard-source-slot";
import { KpiCards } from "./kpi-cards";
import { LeadSummaryTable } from "./lead-summary-table";
import { ReopenRequestsCard } from "./reopen-requests-card";

interface DashboardContentProps {
  readonly organizationName: string;
  readonly activity?: ActivityLiveResponse | undefined;
  readonly activityState: DashboardSourceState;
  readonly review?: SubmissionDashboardRow[] | undefined;
  readonly reviewState: DashboardSourceState;
  readonly weeklyReport?: WeeklyReportReadModel | undefined;
  readonly weeklyState: DashboardSourceState;
  readonly revokeAllPending: boolean;
  readonly onRevokeAll: (reportId: string) => void;
  readonly onRefreshDashboard: () => void;
}

function DashboardHeader({
  weekLabel,
  organizationName,
}: {
  readonly weekLabel: string | null | undefined;
  readonly organizationName: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
          Dashboard
        </h1>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {weekLabel
            ? `${weekLabel} · ${organizationName}`
            : "Loading current period…"}
        </p>
      </div>
    </header>
  );
}

interface DashboardPanelsProps {
  readonly activitySource: DashboardSourceState;
  readonly queue?: ReturnType<typeof mapReviewDashboardData> | undefined;
  readonly queueSource: DashboardSourceState;
  readonly reviewReady: boolean;
  readonly reviewSource: DashboardSourceState;
  readonly weeklySource: DashboardSourceState;
  readonly weekly?: ReturnType<typeof mapWeeklyDashboardData> | undefined;
  readonly weeklyReport?: WeeklyReportReadModel | undefined;
  readonly reminderRuleId: string | null;
  readonly onRefreshDashboard: () => void;
}

function DashboardKpiPanel(props: DashboardPanelsProps) {
  return (
    <DashboardSourceSlot
      kind="kpi"
      ready={props.weekly !== undefined}
      source={props.weeklySource}
      title="KPI data"
    >
      {props.weekly ? <KpiCards data={props.weekly.kpi} /> : null}
    </DashboardSourceSlot>
  );
}

function DashboardQueuePanel(props: DashboardPanelsProps) {
  const reportId = props.weeklyReport?.reportId;
  return (
    <DashboardSourceSlot
      kind="leads"
      ready={props.queue !== undefined}
      source={props.queueSource}
      title="Period summary"
    >
      {props.queue && reportId ? (
        <div className="space-y-3">
          <LeadSummaryTable
            leads={props.queue.leads}
            expectedLeads={props.weekly?.kpi.total}
            reportId={reportId}
            onMutated={props.onRefreshDashboard}
          />
          <DashboardReviewIssue
            ready={props.reviewReady}
            source={props.reviewSource}
          />
          <DashboardActivityIssue source={props.activitySource} />
        </div>
      ) : null}
    </DashboardSourceSlot>
  );
}

function DashboardAlertPanel(props: DashboardPanelsProps) {
  const reportId = props.weeklyReport?.reportId;
  return (
    <DashboardSourceSlot
      kind="alert"
      ready={props.queue !== undefined}
      source={props.queueSource}
      title="Pending leads"
    >
      {props.queue && reportId ? (
        <AlertBar
          pendingLeads={props.queue.pendingLeads}
          reportId={reportId}
          ruleId={props.reminderRuleId}
        />
      ) : null}
    </DashboardSourceSlot>
  );
}

function DashboardEscalationPanel(props: DashboardPanelsProps) {
  return (
    <DashboardSourceSlot
      kind="blocked"
      ready={props.weekly !== undefined}
      source={props.weeklySource}
      title="Escalations"
    >
      {props.weekly ? (
        <BlockedAtRiskTable items={props.weekly.blockedAtRisk} />
      ) : null}
    </DashboardSourceSlot>
  );
}

function DashboardPanels(props: DashboardPanelsProps) {
  return (
    <>
      <DashboardKpiPanel {...props} />
      <DashboardQueuePanel {...props} />
      <DashboardAlertPanel {...props} />
      <ReopenRequestsCard />
      <DashboardEscalationPanel {...props} />
    </>
  );
}

function isPanelLoading(ready: boolean, source: DashboardSourceState): boolean {
  return !ready && !source.isError && !source.stalled;
}

// kpi and blocked panels share the same (weekly, weeklySource) readiness
// inputs — see DashboardKpiPanel / DashboardEscalationPanel above — so one
// check covers both; leads has its own (queue, queueSource) pair.
function dashboardIsLoading(panelModel: DashboardPanelsProps): boolean {
  const kpiOrBlockedLoading = isPanelLoading(
    panelModel.weekly !== undefined,
    panelModel.weeklySource,
  );
  const leadsLoading = isPanelLoading(
    panelModel.queue !== undefined,
    panelModel.queueSource,
  );
  return kpiOrBlockedLoading || leadsLoading;
}

function dashboardPanelModel(
  props: DashboardContentProps,
): DashboardPanelsProps {
  const { activity, review, weeklyReport, weeklyState } = props;
  const queue = weeklyReport
    ? mapReviewDashboardData({
        weeklyReport,
        ...(review ? { review } : {}),
        ...(activity ? { activity } : {}),
      })
    : undefined;
  const weekly = weeklyReport
    ? mapWeeklyDashboardData({ weeklyReport })
    : undefined;
  return {
    queue,
    activitySource: props.activityState,
    queueSource: weeklyState,
    reviewReady: review !== undefined,
    // Review failure must surface in the queue panel that consumes it, even
    // while the weekly-backed panels stay available.
    reviewSource: props.reviewState,
    weeklySource: weeklyState,
    weekly,
    weeklyReport,
    reminderRuleId:
      weeklyReport?.periodStatus === "published"
        ? null
        : (weeklyReport?.activeDeadlineReminderRuleId ?? null),
    onRefreshDashboard: props.onRefreshDashboard,
  };
}

export function DashboardContent(props: DashboardContentProps) {
  const panelModel = dashboardPanelModel(props);
  const submittedCount = props.weeklyReport?.submissionCount ?? 0;
  const isLoading = dashboardIsLoading(panelModel);

  return (
    <div
      className="space-y-6"
      data-dashboard-loading={isLoading}
      aria-busy={isLoading}
    >
      <DashboardHeader
        weekLabel={props.weeklyReport?.weekLabel}
        organizationName={props.organizationName}
      />
      <DashboardPanels {...panelModel} />
      <DashboardRevokeAllControl
        pending={props.revokeAllPending}
        report={props.weeklyReport}
        submittedCount={submittedCount}
        onRevokeAll={props.onRevokeAll}
      />
    </div>
  );
}
