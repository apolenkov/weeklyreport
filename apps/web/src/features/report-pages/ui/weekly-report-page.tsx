"use client";

import type { ReactNode } from "react";

import {
  DocumentActionGroup,
  ReportToolbar,
} from "../../../shared/ui/report-shell/report-toolbar";
import { PeriodNavigator, PublishLockButton } from "../../period";
import { useWeeklyReportPage } from "./use-weekly-report-page";
import { ReportContent } from "./weekly-report-content";
import {
  AcknowledgeSurface,
  CenteredNotice,
  ToolbarExportControl,
} from "./weekly-report-page-content";
import { WeeklyReportSkeleton } from "./weekly-report-skeleton";

interface WeeklyReportPageProps {
  // Concrete report UUID; when set the query targets that report.
  readonly reportId?: string;
  // Auto-redirect to `/head/report/<reportId>` once known; off on `[reportId]`.
  // `canonicalBasePath` (default `/head/report`) selects the addressed surface.
  readonly redirectToCanonical?: boolean;
  readonly canonicalBasePath?: string;
  readonly authorId?: string;
  // "product" accordion list, or "lead" grouping (shared products appear under each).
  readonly scope?: "product" | "lead";
  // Shell-supplied Document-action leading controls (before archive/publish).
  // When omitted the page renders Export itself (ComingSoon for lead).
  readonly documentActionsLeading?: ReactNode;
  // Full Context-control row from the shell; replaces the default period nav.
  // Mutually exclusive with `contextControlsLeading`.
  readonly contextControls?: ReactNode;
  // Controls prepended before the page's default period navigator.
  readonly contextControlsLeading?: ReactNode;
  // Header-line label (not a control) — stays out of the two action rows.
  readonly headerContextLabel?: ReactNode;
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
}: WeeklyReportPageProps) {
  const page = useWeeklyReportPage({
    reportId,
    redirectToCanonical,
    canonicalBasePath,
    authorId,
    scope,
  });

  if (page.kind === "loading") {
    return <WeeklyReportSkeleton />;
  }
  if (page.kind === "notice") {
    return <CenteredNotice title={page.notice.title} body={page.notice.body} />;
  }
  if (page.kind === "empty") {
    return null;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            Status Report
          </h1>
          <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
            Live &middot; {page.submitted}/{page.total} Submitted
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
              showComingSoon={page.showLeadExportComingSoon}
              reportId={page.reportId}
              periodStatus={page.periodStatus}
            />
          )}
          {/* Published-period lifecycle action, distinct from archive filter. */}
          {page.canMutatePeriod && page.periodStatus === "published" && (
            <button
              type="button"
              className="btn-press inline-flex h-[var(--toolbar-control-h)] items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-transparent px-4 py-1.5 font-[family-name:var(--font-sans)] text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-starbucks-accent)] hover:text-[var(--color-starbucks-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={page.handlers.archive}
              disabled={page.mutationState.isArchivePending}
              aria-label="Move this report to the archive"
            >
              {page.mutationState.archiveLabel}
            </button>
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
        </DocumentActionGroup>
      </header>

      <ReportToolbar
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

      <ReportContent
        hasAnyContent={page.hasAnyContent}
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
        focusedProductId={page.focusedProductId}
        scrollTargetProductId={page.scrollTargetProductId}
      />
    </div>
  );
}
