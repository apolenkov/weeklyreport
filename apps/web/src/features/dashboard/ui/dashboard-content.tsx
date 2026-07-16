"use client";

import type {
  ActivityLiveResponse,
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@customreport/shared";
import type { ReactElement } from "react";

import { formatClientErrorMessage } from "../../../lib/client-error-reporting";
import {
  mapReviewDashboardData,
  mapWeeklyDashboardData,
} from "../model/dashboard";
import { AlertBar } from "./alert-bar";
import { BlockedAtRiskTable } from "./blocked-at-risk-table";
import {
  DashboardPanelIssue,
  type DashboardPanelKind,
  DashboardPanelLoading,
} from "./dashboard-panel-state";
import { DashboardRevokeAllControl } from "./dashboard-revoke-all-control";
import { KpiCards } from "./kpi-cards";
import { LeadSummaryTable } from "./lead-summary-table";
import { ReopenRequestsCard } from "./reopen-requests-card";

export interface DashboardSourceState {
  readonly error: unknown;
  readonly isError: boolean;
  readonly retry: () => void;
  readonly stalled: boolean;
}

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

interface SourceSlotProps {
  readonly children: ReactElement | null;
  readonly kind: DashboardPanelKind;
  readonly ready: boolean;
  readonly source: DashboardSourceState;
  readonly title: string;
}

function DashboardSourceSlot({
  children,
  kind,
  ready,
  source,
  title,
}: SourceSlotProps) {
  if (source.isError || source.stalled) {
    const description = source.isError
      ? formatClientErrorMessage(`${title} request failed`, source.error)
      : `${title} is taking longer than expected.`;
    return (
      <DashboardPanelIssue
        kind={kind}
        title={`${title} unavailable`}
        description={description}
        onRetry={source.retry}
      />
    );
  }
  return ready ? children : <DashboardPanelLoading kind={kind} />;
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
  readonly queue?: ReturnType<typeof mapReviewDashboardData>;
  readonly pending?: ReturnType<typeof mapReviewDashboardData>;
  readonly queueSource: DashboardSourceState;
  readonly reviewSource: DashboardSourceState;
  readonly weekly?: ReturnType<typeof mapWeeklyDashboardData>;
  readonly weeklyReport?: WeeklyReportReadModel;
  readonly weeklyState: DashboardSourceState;
  readonly canSendReminder: boolean;
  readonly onRefreshDashboard: () => void;
}

function DashboardPanels(props: DashboardPanelsProps) {
  const reportId = props.weeklyReport?.reportId;
  return (
    <>
      <DashboardSourceSlot
        kind="kpi"
        ready={props.weekly !== undefined}
        source={props.weeklyState}
        title="KPI data"
      >
        {props.weekly ? <KpiCards data={props.weekly.kpi} /> : null}
      </DashboardSourceSlot>
      <DashboardSourceSlot
        kind="leads"
        ready={props.queue !== undefined}
        source={props.queueSource}
        title="Period summary"
      >
        {props.queue && reportId ? (
          <LeadSummaryTable
            leads={props.queue.leads}
            reportId={reportId}
            onMutated={props.onRefreshDashboard}
          />
        ) : null}
      </DashboardSourceSlot>
      <DashboardSourceSlot
        kind="alert"
        ready={props.pending !== undefined}
        source={props.reviewSource}
        title="Pending leads"
      >
        {props.pending && reportId ? (
          <AlertBar
            pendingLeads={props.pending.pendingLeads}
            reportId={reportId}
            canSendReminder={props.canSendReminder}
          />
        ) : null}
      </DashboardSourceSlot>
      <ReopenRequestsCard />
      <DashboardSourceSlot
        kind="blocked"
        ready={props.weekly !== undefined}
        source={props.weeklyState}
        title="Escalations"
      >
        {props.weekly ? (
          <BlockedAtRiskTable items={props.weekly.blockedAtRisk} />
        ) : null}
      </DashboardSourceSlot>
    </>
  );
}

export function DashboardContent({
  organizationName,
  activity,
  activityState,
  review,
  reviewState,
  weeklyReport,
  weeklyState,
  revokeAllPending,
  onRevokeAll,
  onRefreshDashboard,
}: DashboardContentProps) {
  const pendingData =
    review && weeklyReport
      ? mapReviewDashboardData({ review, weeklyReport })
      : undefined;
  const queueData =
    review && weeklyReport && activity
      ? mapReviewDashboardData({ review, weeklyReport, activity })
      : undefined;
  const weekly = weeklyReport
    ? mapWeeklyDashboardData({
        weeklyReport,
        ...(pendingData
          ? { pendingCount: pendingData.pendingLeads.length }
          : {}),
      })
    : undefined;
  const reviewSource = resolveDependentSource([weeklyState, reviewState]);
  const queueSource = resolveDependentSource([
    weeklyState,
    reviewState,
    activityState,
  ]);
  const canSendReminder = Boolean(
    weeklyReport &&
      weeklyReport.periodStatus !== "published" &&
      weeklyReport.hasActiveReminderRule,
  );
  const submittedCount = weeklyReport?.submissionCount ?? 0;

  return (
    <div className="space-y-6">
      <DashboardHeader
        weekLabel={weeklyReport?.weekLabel}
        organizationName={organizationName}
      />
      <DashboardPanels
        queue={queueData}
        pending={pendingData}
        queueSource={queueSource}
        reviewSource={reviewSource}
        weekly={weekly}
        weeklyReport={weeklyReport}
        weeklyState={weeklyState}
        canSendReminder={canSendReminder}
        onRefreshDashboard={onRefreshDashboard}
      />
      <DashboardRevokeAllControl
        pending={revokeAllPending}
        report={weeklyReport}
        submittedCount={submittedCount}
        onRevokeAll={onRevokeAll}
      />
    </div>
  );
}
