"use client";

import type {
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@customreport/shared";
import type { ReactElement } from "react";

import { formatClientErrorMessage } from "../../../lib/client-error-reporting";
import { SectionReviewStrip, toSectionReviewRows } from "../../review";
import {
  mapReviewDashboardData,
  mapWeeklyDashboardData,
} from "../model/dashboard";
import { ActivityLivePanel } from "./activity-live-panel";
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

function resolveReviewSource(
  review: DashboardSourceState,
  weekly: DashboardSourceState,
): DashboardSourceState {
  return weekly.isError || weekly.stalled ? weekly : review;
}

interface DashboardPanelsProps {
  readonly review?: ReturnType<typeof mapReviewDashboardData>;
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
        ready={props.review !== undefined}
        source={props.reviewSource}
        title="Period summary"
      >
        {props.review && reportId ? (
          <LeadSummaryTable
            leads={props.review.leads}
            reportId={reportId}
            canSendReminder={props.canSendReminder}
          />
        ) : null}
      </DashboardSourceSlot>
      <DashboardSourceSlot
        kind="alert"
        ready={props.review !== undefined}
        source={props.reviewSource}
        title="Pending leads"
      >
        {props.review && reportId ? (
          <AlertBar
            pendingLeads={props.review.pendingLeads}
            reportId={reportId}
            canSendReminder={props.canSendReminder}
          />
        ) : null}
      </DashboardSourceSlot>
      <DashboardSourceSlot
        kind="review"
        ready={props.weeklyReport !== undefined}
        source={props.weeklyState}
        title="Review context"
      >
        {props.weeklyReport ? (
          <SectionReviewStrip
            sections={toSectionReviewRows(props.weeklyReport.leadSections)}
            onMutated={props.onRefreshDashboard}
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
  review,
  reviewState,
  weeklyReport,
  weeklyState,
  revokeAllPending,
  onRevokeAll,
  onRefreshDashboard,
}: DashboardContentProps) {
  const reviewData =
    review && weeklyReport
      ? mapReviewDashboardData({ review, weeklyReport })
      : undefined;
  const weekly = weeklyReport
    ? mapWeeklyDashboardData({
        weeklyReport,
        ...(reviewData ? { pendingCount: reviewData.pendingLeads.length } : {}),
      })
    : undefined;
  const reviewSource = resolveReviewSource(reviewState, weeklyState);
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
      <DashboardRevokeAllControl
        pending={revokeAllPending}
        report={weeklyReport}
        submittedCount={submittedCount}
        onRevokeAll={onRevokeAll}
      />
      <ActivityLivePanel />
      <DashboardPanels
        review={reviewData}
        reviewSource={reviewSource}
        weekly={weekly}
        weeklyReport={weeklyReport}
        weeklyState={weeklyState}
        canSendReminder={canSendReminder}
        onRefreshDashboard={onRefreshDashboard}
      />
    </div>
  );
}
