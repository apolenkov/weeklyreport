"use client";

import { type ReactNode, useState } from "react";

import {
  DocumentActionGroup,
  ReportToolbar,
} from "../../../../shared/ui/report-shell/report-toolbar";
import { PeriodNavigator, PublishLockButton } from "../../../period";
import { ArchiveRestoreActions } from "./archive-restore-actions";
import { useWeeklyReportPage } from "./use-weekly-report-page";
import { ReportContent } from "./weekly-report-content";
import type {
  ReadyWeeklyReportPage,
  WeeklyReportPageProps,
} from "./weekly-report-page.types";
import {
  AcknowledgeSurface,
  CenteredNotice,
  ToolbarExportControl,
} from "./weekly-report-page-content";
import { WeeklyReportSkeleton } from "./weekly-report-skeleton";

function PeriodLifecycleActions({
  page,
}: {
  readonly page: ReadyWeeklyReportPage;
}) {
  return (
    <>
      {/* Archive/restore of this report, distinct from the archive filter. */}
      {page.canMutatePeriod && (
        <ArchiveRestoreActions
          archived={page.archived}
          periodStatus={page.periodStatus}
          onArchive={page.handlers.archive}
          onRestore={page.handlers.restore}
          mutationState={page.mutationState}
        />
      )}
      {/* With Publish so review → acknowledge → publish reads as one sequence. */}
      {page.canMutatePeriod && (
        <AcknowledgeSurface
          reviewModel={page.reviewModel}
          reportId={page.reportId}
          placement="header"
        />
      )}
      {page.canMutatePeriod && (
        <PublishLockButton
          pendingCount={page.pendingCount}
          totalLeads={page.total}
          periodStatus={page.periodStatus}
          onPublish={page.handlers.publish}
          onReopen={page.handlers.reopen}
          isPending={page.mutationState.isPublishOrReopenPending}
          canPublish={page.canPublishReport}
          publishDisabledReason="Publish requires at least one submitted section."
        />
      )}
    </>
  );
}

function reportLifecycleLabel(page: ReadyWeeklyReportPage): string {
  if (page.archived) return "Archived";
  if (page.periodStatus === "published") return "Published";
  return "Live";
}

function WeeklyReportHeader({
  page,
  documentActionsLeading,
  headerContextLabel,
}: {
  readonly page: ReadyWeeklyReportPage;
  readonly documentActionsLeading?: ReactNode;
  readonly headerContextLabel?: ReactNode;
}) {
  return (
    <header
      data-layout-key="weekly-report-header"
      data-layout-stability="position-size"
      className="flex flex-wrap items-center justify-between gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
          Status Report
        </h1>
        <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
          {reportLifecycleLabel(page)} &middot; {page.submitted}/{page.total}{" "}
          Submitted
        </span>
        {page.showPublishHint && (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            Publish requires at least one submitted section.
          </span>
        )}
        {headerContextLabel}
      </div>
      <DocumentActionGroup>
        {documentActionsLeading ?? (
          <ToolbarExportControl
            canExportPdf={page.canExportPdf}
            reportId={page.reportId}
            periodStatus={page.periodStatus}
          />
        )}
        <PeriodLifecycleActions page={page} />
      </DocumentActionGroup>
    </header>
  );
}

function WeeklyReportContextToolbar({
  page,
  contextControls,
  contextControlsLeading,
}: {
  readonly page: ReadyWeeklyReportPage;
  readonly contextControls?: ReactNode;
  readonly contextControlsLeading?: ReactNode;
}) {
  return (
    <ReportToolbar
      layoutKey="report-context-toolbar"
      contextControls={
        contextControls ?? (
          <>
            {contextControlsLeading}
            <PeriodNavigator
              periods={page.periods}
              urlBuilder={(periodId) =>
                `/head/report/${encodeURIComponent(periodId)}`
              }
            />
          </>
        )
      }
    />
  );
}

function WeeklyReportBody({
  page,
  scope,
  initialFocusedLeadId,
}: {
  readonly page: ReadyWeeklyReportPage;
  readonly scope: "product" | "lead";
  readonly initialFocusedLeadId: string | undefined;
}) {
  // Overview-card clicks lift their target into React state here; the accordion
  // and lead sections react to it. No component reaches into another's DOM.
  const [overviewNavigation, setOverviewNavigation] = useState<{
    readonly targetId: string | undefined;
    readonly epochs: ReadonlyMap<string, number>;
  }>({ targetId: undefined, epochs: new Map() });
  const focusedTargetId = overviewNavigation.targetId;
  const focusedProductId = focusedTargetId ?? page.focusedProductId;
  const focusedLeadId =
    scope === "lead" ? (focusedTargetId ?? initialFocusedLeadId) : undefined;
  const navigateOverview = (targetId: string): void => {
    if (page.submittedOnly) page.handlers.setSubmissionFilter("all");
    setOverviewNavigation((current) => {
      const epochs = new Map(current.epochs);
      epochs.set(targetId, (epochs.get(targetId) ?? 0) + 1);
      return { targetId, epochs };
    });
  };

  return (
    <ReportContent
      hasAnyContent={page.hasAnyContent}
      submissionCount={page.submitted}
      periodStatus={page.periodStatus}
      periodLabel={page.periodLabel}
      scope={scope}
      activitySections={page.activitySections}
      portfolio={page.portfolio}
      leadOverviewRows={page.leadOverviewRows}
      reviewModel={page.reviewModel}
      reportId={page.reportId}
      accordion={page.accordion}
      reviewEnabled={page.reviewEnabled}
      canReviewAny={page.canReviewAny}
      reviewMode={page.reviewMode}
      onReviewModeChange={page.handlers.setReviewMode}
      submittedOnly={page.submittedOnly}
      submissionFilter={page.submissionFilter}
      onFilterChange={page.handlers.setSubmissionFilter}
      focusedProductId={focusedProductId}
      scrollTargetProductId={focusedProductId}
      focusedLeadId={focusedLeadId}
      overviewNavigationEpochs={overviewNavigation.epochs}
      onNavigateOverview={navigateOverview}
    />
  );
}

export function WeeklyReportPage({
  reportId,
  redirectToCanonical,
  canonicalBasePath = "/head/report",
  authorId,
  scope = "product",
  documentActionsLeading,
  contextControls,
  contextControlsLeading,
  headerContextLabel,
  loadingAudience = "head",
}: WeeklyReportPageProps) {
  const page = useWeeklyReportPage({
    reportId,
    redirectToCanonical,
    canonicalBasePath,
    authorId,
    scope,
  });

  if (page.kind === "loading") {
    return <WeeklyReportSkeleton audience={loadingAudience} />;
  }
  if (page.kind === "notice") {
    return <CenteredNotice title={page.notice.title} body={page.notice.body} />;
  }
  if (page.kind === "empty") {
    return null;
  }

  return (
    <div
      className="space-y-4"
      data-layout-key="report-page"
      data-layout-stability="position-width"
    >
      <WeeklyReportHeader
        page={page}
        documentActionsLeading={documentActionsLeading}
        headerContextLabel={headerContextLabel}
      />
      <WeeklyReportContextToolbar
        page={page}
        contextControls={contextControls}
        contextControlsLeading={contextControlsLeading}
      />
      <WeeklyReportBody
        page={page}
        scope={scope}
        initialFocusedLeadId={authorId}
      />
    </div>
  );
}
