"use client";

import type { WeeklyReportGetResponse } from "@customreport/shared";
import { ComingSoonControl } from "@customreport/ui/components/coming-soon-control";
import { Skeleton } from "@customreport/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { LayoutTemplate } from "lucide-react";
import { useCallback, useContext, useMemo, useState } from "react";

import { SessionContext } from "../../../../shared/lib/auth/session-provider";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
import { AgentReviewComingSoon } from "../../../../shared/ui/report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../../../../shared/ui/report-shell/archive-toggle";
import {
  DocumentActionGroup,
  ReportToolbar,
  ReportToolbarCenterLabel,
} from "../../../../shared/ui/report-shell/report-toolbar";
import { ScopeToggle } from "../../../../shared/ui/report-shell/scope-toggle";
import {
  type ReportShellScopeValue,
  useReportShellUrlState,
} from "../../../../shared/ui/report-shell/use-report-shell-url-state";
import { ViewModeToggle } from "../../../../shared/ui/report-shell/view-mode-toggle";
import { ExportPdfButton } from "../../../pdf-export";
import {
  deriveHeadPeriods,
  HeadPublishLockAction,
  PeriodNavigationSkeleton,
  PeriodNavigator,
} from "../../../period";
import type { ReportPeriod } from "../../../report-sections";
import {
  HeadSlidesClient,
  type SlideDensity,
  SlideDensityControl,
} from "../../../slides";
import { WeeklyReportPage } from "../weekly/weekly-report-page";

// Module-scope so the reference is stable across renders — a fresh literal would
// churn the hook's `buildQuery` memoization. The head strips no one-shot markers.
const HEAD_STRIP_PARAMS: readonly string[] = [];

// The header always renders a department label beside the title, so a session
// without an organization falls back to the product name rather than a gap.
const FALLBACK_DEPARTMENT_LABEL = "CustomReport";

// Declared URL-state seam — not the hook's raw return type.
interface ReportShellUrlState {
  readonly buildQuery: (overrides: Record<string, string | null>) => string;
  readonly includeArchive: boolean;
  readonly setIncludeArchive: (value: boolean) => void;
  readonly scope: ReportShellScopeValue;
  readonly setScope: (value: ReportShellScopeValue) => void;
}

interface HeadReportShellProps {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly authorId?: string | undefined;
}

// Org fullName comes from auth.me; the shared context bar is suppressed for the
// head, so the department label is surfaced beside the page title instead.
function HeadDepartmentLabel() {
  const sessionState = useContext(SessionContext);
  return (
    <ReportToolbarCenterLabel
      label={sessionState?.organization?.fullName ?? FALLBACK_DEPARTMENT_LABEL}
      detail="Live portfolio review"
    />
  );
}

const HEAD_DEPARTMENT_LABEL = <HeadDepartmentLabel />;

function HeadContextTrailing({
  urlState,
  reportId,
  mode,
  density,
  onDensityChange,
}: {
  readonly urlState: ReportShellUrlState;
  readonly reportId: string;
  readonly mode: HeadReportShellProps["mode"];
  readonly density: SlideDensity;
  readonly onDensityChange: (density: SlideDensity) => void;
}) {
  const { buildQuery, scope, setScope } = urlState;
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5"
      data-testid="head-context-trailing"
    >
      <AgentReviewComingSoon compact />
      <ScopeToggle
        value={scope}
        onChange={setScope}
        allowedScopes={["product", "lead"]}
      />
      <ViewModeToggle
        editHref={`/head/report/${encodeURIComponent(reportId)}${buildQuery({ mode: null })}`}
        slidesHref={`/head/report/${encodeURIComponent(reportId)}${buildQuery({ mode: "slides" })}`}
        mode={mode === "slides" ? "slides" : "edit"}
        desktopLabels
      />
      {mode === "slides" ? (
        <>
          <ComingSoonControl
            icon={LayoutTemplate}
            label="Slide templates"
            ariaLabel="Slide templates are coming soon"
            testId="slide-templates-coming-soon"
            compact
          />
          <SlideDensityControl value={density} onChange={onDensityChange} />
        </>
      ) : null}
    </div>
  );
}

// Toolbar hosts the single Agent-review placeholder in both modes.
function HeadContextControls({
  periods,
  reportId,
  mode,
  urlState,
  historyError,
  historyLoading,
  density,
  onDensityChange,
}: {
  readonly periods: readonly ReportPeriod[];
  readonly reportId: string;
  readonly mode: HeadReportShellProps["mode"];
  readonly urlState: ReportShellUrlState;
  readonly historyError: boolean;
  readonly historyLoading: boolean;
  readonly density: SlideDensity;
  readonly onDensityChange: (density: SlideDensity) => void;
}) {
  const { buildQuery, includeArchive, setIncludeArchive } = urlState;
  const urlBuilder = useCallback(
    (periodId: string) =>
      `/head/report/${encodeURIComponent(periodId)}${buildQuery({})}`,
    [buildQuery],
  );

  return (
    <>
      {historyError ? (
        <span
          className="text-xs font-medium text-[var(--color-destructive)]"
          role="alert"
          data-testid="head-history-error"
        >
          Period history unavailable
        </span>
      ) : historyLoading ? (
        <PeriodNavigationSkeleton testId="head-period-navigation-skeleton" />
      ) : periods.length > 0 ? (
        <PeriodNavigator periods={periods} urlBuilder={urlBuilder} />
      ) : null}
      <ArchiveToggle checked={includeArchive} onChange={setIncludeArchive} />
      <div className="grow" aria-hidden="true" />
      <HeadContextTrailing
        urlState={urlState}
        reportId={reportId}
        mode={mode}
        density={density}
        onDensityChange={onDensityChange}
      />
    </>
  );
}

function SlidesModeHeader({
  reportId,
  headerContextLabel,
  exportPdf,
  isLoading,
}: {
  readonly reportId: string;
  readonly headerContextLabel: React.ReactNode;
  readonly exportPdf: React.ReactNode;
  readonly isLoading: boolean;
}) {
  return (
    <header
      data-layout-key="weekly-report-header"
      data-layout-stability="position-size"
      className="flex min-h-36 flex-wrap items-center justify-between gap-4 sm:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
          Status Report
        </h1>
        {headerContextLabel}
      </div>
      {/* Header hosts document actions; deck already covers slide nav. */}
      <DocumentActionGroup>
        {isLoading ? (
          <>
            <Skeleton className="h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] rounded-[var(--radius-pill)]" />
            <Skeleton className="h-[var(--toolbar-control-h)] w-36 rounded-[var(--radius-pill)]" />
          </>
        ) : (
          <>
            {exportPdf}
            <HeadPublishLockAction reportId={reportId} />
          </>
        )}
      </DocumentActionGroup>
    </header>
  );
}

// History omits the active week, so the displayed and active periods are fetched
// separately and prepended. Both use WeeklyReportPage's key, so RQ dedupes; the
// active fetch carries no reportId so the navigator can always return to it.
function useHeadPeriodData(reportId: string, includeArchive: boolean) {
  const trpc = useTRPC();
  const historyQ = useQuery(
    trpc.reports.compiledHistory.queryOptions({ includeArchive }),
  );
  const displayedQ = useQuery(trpc.weeklyReport.get.queryOptions({ reportId }));
  const activeQ = useQuery(trpc.weeklyReport.get.queryOptions({}));

  const periods: readonly ReportPeriod[] = useMemo(
    () =>
      deriveHeadPeriods(
        historyQ.data?.entries ?? [],
        activeQ.data,
        displayedQ.data,
        reportId,
      ),
    [historyQ.data, activeQ.data, displayedQ.data, reportId],
  );

  return {
    periods,
    displayed: displayedQ.data,
    historyError: historyQ.isError,
    isLoading: historyQ.isLoading || displayedQ.isLoading || activeQ.isLoading,
  };
}

// `undefined` (not a null-rendering element) when there is no period, so the
// action groups receive no child at all.
function renderExportPdf(
  displayed: WeeklyReportGetResponse | undefined,
): React.ReactNode {
  if (!displayed || displayed.status === "no-period") return undefined;
  return (
    <ExportPdfButton
      reportId={displayed.reportId}
      periodStatus={displayed.periodStatus}
    />
  );
}

export function HeadReportShell({
  reportId,
  mode,
  authorId,
}: HeadReportShellProps) {
  // Scope + archive filter in the URL so refresh/shared links restore them.
  const urlState = useReportShellUrlState({ stripParams: HEAD_STRIP_PARAMS });
  const [density, setDensity] = useState<SlideDensity>("document");
  const { periods, displayed, historyError, isLoading } = useHeadPeriodData(
    reportId,
    urlState.includeArchive,
  );

  const headerContextLabel = HEAD_DEPARTMENT_LABEL;
  const exportPdf = renderExportPdf(displayed);
  const contextControls = (
    <HeadContextControls
      periods={periods}
      reportId={reportId}
      mode={mode}
      urlState={urlState}
      historyError={historyError}
      historyLoading={isLoading}
      density={density}
      onDensityChange={setDensity}
    />
  );

  return (
    <div
      className="space-y-4"
      data-layout-key={mode === "slides" ? "report-page" : undefined}
      data-layout-stability={mode === "slides" ? "position-width" : undefined}
    >
      {mode === "slides" ? (
        <>
          <SlidesModeHeader
            reportId={reportId}
            headerContextLabel={headerContextLabel}
            exportPdf={exportPdf}
            isLoading={isLoading}
          />
          {/* Slides has no WeeklyReportPage; the shell owns the toolbar. */}
          <ReportToolbar
            contextControls={contextControls}
            layoutKey="report-context-toolbar"
          />
          <HeadSlidesClient
            reportId={reportId}
            scope={urlState.scope}
            density={density}
            onDensityChange={setDensity}
          />
        </>
      ) : (
        <div className="min-w-0">
          <WeeklyReportPage
            reportId={reportId}
            authorId={authorId}
            scope={urlState.scope}
            documentActionsLeading={exportPdf}
            contextControls={contextControls}
            headerContextLabel={headerContextLabel}
            loadingAudience="head"
          />
        </div>
      )}
    </div>
  );
}
