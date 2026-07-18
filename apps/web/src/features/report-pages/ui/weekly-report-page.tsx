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
  /**
   * Concrete report identifier (UUID). When provided, the query targets that
   * specific report; used by /reports/[reportId] route pages.
   */
  readonly reportId?: string;
  /**
   * When true, the page auto-redirects (router.replace) to the canonical
   * addressed URL `/head/report/<reportId>` once the active reportId is known.
   * Off when already on a `[reportId]` route.
   *
   * Optional `canonicalBasePath` (defaults to `/head/report`) lets callers
   * point the redirect at a different addressed surface.
   */
  readonly redirectToCanonical?: boolean;
  readonly canonicalBasePath?: string;
  readonly authorId?: string;
  /**
   * Grouping axis (head split-view parity). "product" (default)
   * is the classic per-product accordion list; "lead" groups products under
   * each authoring lead. A product shared by several leads appears under each —
   * leads own their own phases, so the duplication is expected.
   */
  readonly scope?: "product" | "lead";
  /**
   * report-toolbar-layout: the page owns the single two-row ReportToolbar. An
   * outer shell (HeadReportShell) supplies leading Document-action-row controls
   * here — head passes its labeled Export-PDF — rendered before the page's own
   * Move-to-archive / Publish lifecycle actions. When omitted the page renders
   * the shared Export control itself (head/admin/viewer get the real export;
   * lead sees the inert ComingSoon).
   */
  readonly documentActionsLeading?: ReactNode;
  /**
   * report-toolbar-layout: the FULL Context-control row (bottom row), composed
   * by an outer shell that owns a richer period navigator (HeadReportShell
   * prepends the active/displayed periods compiledHistory omits). When provided
   * it replaces the page's default context row, including period navigation.
   * Mutually exclusive with `contextControlsLeading`.
   */
  readonly contextControls?: ReactNode;
  /**
   * report-toolbar-layout: Context-control-row controls prepended before the
   * page's default period navigator. Used by standalone consumers (the viewer)
   * that reuse the page's own period nav but add the Agent-review placeholder
   * (leading edge) and Back-to-Archive navigation to the bottom row.
   */
  readonly contextControlsLeading?: ReactNode;
  /**
   * head-toolbar-parity: a context label (department name plus a short page
   * descriptor) rendered on the header line beside the title. It is a label,
   * not a control, so it stays out of the two action rows. Head form mode
   * passes it; standalone consumers omit it.
   */
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
      {/* Page header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            Status Report
          </h1>
          <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[var(--color-success)] px-2.5 py-1 text-xs font-semibold text-[var(--color-primary)]">
            Live &middot; {page.submitted}/{page.total} Submitted
          </span>
          {/* head-toolbar-semantics: the publish precondition hint sits on the
              report-status row (not the action row). */}
          {page.showPublishHint && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Publish requires at least one submitted section.
            </span>
          )}
          {/* head-toolbar-parity: department context label — a label, not a
              control, so it stays on the header line, out of the action rows. */}
          {headerContextLabel}
        </div>
        {/* report-toolbar-layout: document actions live on the header line's
            right slot, not inside the bordered toolbar. The labeled Export-PDF
            (or a shell-supplied leading action) leads, then the head lifecycle
            actions (Move-to-archive, Publish & Lock). Viewer and the lead
            preview have no mutating actions, so only the export control renders. */}
        <DocumentActionGroup>
          {documentActionsLeading ?? (
            <ToolbarExportControl
              canExportPdf={page.canExportPdf}
              showComingSoon={page.showLeadExportComingSoon}
              reportId={page.reportId}
              periodStatus={page.periodStatus}
            />
          )}
          {/* Move-to-archive — a published-period lifecycle action, so it is a
              document action (neutral/outline), distinct from the show-archived
              filter in the context bar. Hidden after archiving because this page
              only navigates active periods. */}
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
          {/* The head/admin Acknowledge control sits WITH Publish & Lock so
              review → acknowledge → publish reads as one sequence. It never
              gates publish; AcknowledgeSurface self-suppresses when review is
              disabled (e.g. a published period). */}
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

      {/* report-toolbar-layout: the bordered toolbar holds only the
          Context-control bar — either a shell-composed row (head) or the page's
          default period navigator, optionally preceded by leading controls
          (the viewer's Agent review). */}
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

      {/* Report body: true empty-state OR the review surfaces + §7-filtered
          accordion. A helper so this page function stays under the complexity
          budget; the empty-state gate keys off FULL content (head-report-
          visibility), never the submitted count or the filtered accordion. */}
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
