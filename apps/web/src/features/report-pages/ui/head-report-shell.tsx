"use client";

import type { WeeklyReportGetResponse } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useContext, useMemo } from "react";

import { SessionContext } from "../../../shared/lib/auth/session-provider";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { AgentReviewComingSoon } from "../../../shared/ui/report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../../../shared/ui/report-shell/archive-toggle";
import {
  DocumentActionGroup,
  ReportToolbar,
  ReportToolbarCenterLabel,
} from "../../../shared/ui/report-shell/report-toolbar";
import { ScopeToggle } from "../../../shared/ui/report-shell/scope-toggle";
import {
  type ReportShellScopeValue,
  useReportShellUrlState,
} from "../../../shared/ui/report-shell/use-report-shell-url-state";
import { ViewModeToggle } from "../../../shared/ui/report-shell/view-mode-toggle";
import { ExportPdfButton } from "../../pdf-export";
import {
  deriveHeadPeriods,
  HeadPublishLockAction,
  PeriodNavigator,
} from "../../period";
import type { ReportPeriod } from "../../report-sections";
import { HeadSlidesClient } from "../../slides";
import { WeeklyReportPage } from "./weekly-report-page";

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

// Toolbar hosts the single Agent-review placeholder in both modes.
function HeadContextControls({
  periods,
  reportId,
  mode,
  urlState,
  historyError,
}: {
  readonly periods: readonly ReportPeriod[];
  readonly reportId: string;
  readonly mode: HeadReportShellProps["mode"];
  readonly urlState: ReportShellUrlState;
  readonly historyError: boolean;
}) {
  const { buildQuery, includeArchive, setIncludeArchive, scope, setScope } =
    urlState;
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
      ) : periods.length > 0 ? (
        <PeriodNavigator periods={periods} urlBuilder={urlBuilder} />
      ) : null}
      <ArchiveToggle checked={includeArchive} onChange={setIncludeArchive} />
      <div className="grow" aria-hidden="true" />
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
      />
    </>
  );
}

function SlidesModeHeader({
  reportId,
  headerContextLabel,
  exportPdf,
}: {
  readonly reportId: string;
  readonly headerContextLabel: React.ReactNode;
  readonly exportPdf: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            Status Report
          </h1>
        </div>
        {headerContextLabel}
      </div>
      {/* Header hosts document actions; deck already covers slide nav. */}
      <DocumentActionGroup>
        {exportPdf}
        <HeadPublishLockAction reportId={reportId} />
      </DocumentActionGroup>
    </header>
  );
}

// Declared data-loading seam — not the hook's raw return type.
interface HeadPeriodData {
  readonly periods: readonly ReportPeriod[];
  readonly displayed: WeeklyReportGetResponse | undefined;
  readonly historyError: boolean;
}

// History omits the active week, so the displayed and active periods are fetched
// separately and prepended. Both use WeeklyReportPage's key, so RQ dedupes; the
// active fetch carries no reportId so the navigator can always return to it.
function useHeadPeriodData(
  reportId: string,
  includeArchive: boolean,
): HeadPeriodData {
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
  };
}

// `undefined` (not a null-rendering element) when there is no period, so the
// action groups receive no child at all.
function renderExportPdf(
  displayed: HeadPeriodData["displayed"],
): React.ReactNode {
  return displayed && displayed.status !== "no-period" ? (
    <ExportPdfButton
      reportId={displayed.reportId}
      periodStatus={displayed.periodStatus}
    />
  ) : undefined;
}

export function HeadReportShell({
  reportId,
  mode,
  authorId,
}: HeadReportShellProps) {
  // Scope + archive filter in the URL so refresh/shared links restore them.
  const urlState = useReportShellUrlState({ stripParams: HEAD_STRIP_PARAMS });
  const { periods, displayed, historyError } = useHeadPeriodData(
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
    />
  );

  return (
    <div className="space-y-4">
      {mode === "slides" ? (
        <>
          <SlidesModeHeader
            reportId={reportId}
            headerContextLabel={headerContextLabel}
            exportPdf={exportPdf}
          />
          {/* Slides has no WeeklyReportPage; the shell owns the toolbar. */}
          <ReportToolbar contextControls={contextControls} />
          <HeadSlidesClient reportId={reportId} scope={urlState.scope} />
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
          />
        </div>
      )}
    </div>
  );
}
