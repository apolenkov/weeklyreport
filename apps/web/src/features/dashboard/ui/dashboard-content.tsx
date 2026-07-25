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
  DashboardSourceSlot,
  type DashboardSourceState,
} from "./dashboard-source-slot";
import { KpiCards } from "./kpi-cards";
import { LeadSummaryTable } from "./lead-summary-table";
import { ReopenRequestsCard } from "./reopen-requests-card";

interface DashboardContentProps {
  readonly organizationName: string;
  readonly activity?: ActivityLiveResponse;
  readonly activityState: DashboardSourceState;
  readonly review?: SubmissionDashboardRow[];
  readonly reviewState: DashboardSourceState;
  readonly weeklyReport?: WeeklyReportReadModel;
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

function resolveDependentSource(
  sources: readonly [DashboardSourceState, ...DashboardSourceState[]],
): DashboardSourceState {
  return (
    sources.find((source) => source.isError || source.stalled) ?? sources[0]
  );
}

interface DashboardPanelsProps {
  readonly activitySource: DashboardSourceState;
  readonly queue?: ReturnType<typeof mapReviewDashboardData>;
  readonly queueSource: DashboardSourceState;
  readonly reviewSource: DashboardSourceState;
  readonly weekly?: ReturnType<typeof mapWeeklyDashboardData>;
  readonly weeklyReport?: WeeklyReportReadModel;
  readonly canSendReminder: boolean;
  readonly onRefreshDashboard: () => void;
}

function DashboardKpiPanel(props: DashboardPanelsProps) {
  return (
    <DashboardSourceSlot
      kind="kpi"
      ready={props.weekly !== undefined}
      source={props.reviewSource}
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
            reportId={reportId}
            onMutated={props.onRefreshDashboard}
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
          canSendReminder={props.canSendReminder}
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
      source={props.reviewSource}
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

// kpi and blocked panels share the same (weekly, reviewSource) readiness
// inputs — see DashboardKpiPanel / DashboardEscalationPanel above — so one
// check covers both; leads has its own (queue, queueSource) pair.
function dashboardIsLoading(panelModel: DashboardPanelsProps): boolean {
  const kpiOrBlockedLoading = isPanelLoading(
    panelModel.weekly !== undefined,
    panelModel.reviewSource,
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
  const { activity, review, weeklyReport, weeklyState, reviewState } = props;
  const queue = weeklyReport
    ? mapReviewDashboardData({
        weeklyReport,
        ...(review ? { review } : {}),
        ...(activity ? { activity } : {}),
      })
    : undefined;
  const weekly =
    weeklyReport && review
      ? mapWeeklyDashboardData({
          weeklyReport,
          pendingCount: queue?.pendingLeads.length ?? 0,
        })
      : undefined;
  return {
    queue,
    activitySource: props.activityState,
    queueSource: weeklyState,
    reviewSource: resolveDependentSource([weeklyState, reviewState]),
    weekly,
    weeklyReport,
    canSendReminder: Boolean(
      weeklyReport &&
      weeklyReport.periodStatus !== "published" &&
      weeklyReport.hasActiveReminderRule,
    ),
    onRefreshDashboard: props.onRefreshDashboard,
  };
}

/**
 * Dashboard Content.
 * @param props - The props argument.
 */
export function DashboardContent(props: DashboardContentProps) {
  const panelModel = dashboardPanelModel(props);
  const submittedCount = props.weeklyReport?.submissionCount ?? 0;
  const isLoading = dashboardIsLoading(panelModel);

  return (
    <div className="space-y-6" data-dashboard-loading={isLoading}>
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
