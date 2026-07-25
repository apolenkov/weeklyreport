"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useContext, useMemo } from "react";

import { SessionContext } from "../../../lib/session-provider";
import { useTRPC } from "../../../lib/trpc-context";
import { AgentReviewComingSoon } from "../../../shared/ui/report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../../../shared/ui/report-shell/archive-toggle";
import {
  DocumentActionGroup,
  ReportToolbar,
  ReportToolbarCenterLabel,
} from "../../../shared/ui/report-shell/report-toolbar";
import { ScopeToggle } from "../../../shared/ui/report-shell/scope-toggle";
import { useReportShellUrlState } from "../../../shared/ui/report-shell/use-report-shell-url-state";
import { ViewModeToggle } from "../../../shared/ui/report-shell/view-mode-toggle";
import { ExportPdfButton } from "../../pdf-export";
import { HeadPublishLockAction, PeriodNavigator } from "../../period";
import type { ReportPeriod } from "../../report-sections";
import { HeadSlidesClient } from "../../slides";
import { deriveHeadPeriods } from "./head-report-periods";
import { WeeklyReportPage } from "./weekly-report-page";

// Module-scope so the reference is stable across renders — a fresh literal would
// churn the hook's `buildQuery` memoization. The head strips no one-shot markers.
const HEAD_STRIP_PARAMS: readonly string[] = [];

interface HeadReportShellProps {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly authorId?: string;
}

export function HeadReportShell({
  reportId,
  mode,
  authorId,
}: HeadReportShellProps) {
  const trpc = useTRPC();

  // Org fullName from auth.me; context bar is suppressed, so surface it here.
  const sessionState = useContext(SessionContext);
  const departmentLabel =
    sessionState?.organization?.fullName ?? "CustomReport";

  // Scope + archive filter in the URL so refresh/shared links restore them.
  // Head strips nothing (no one-shot markers).
  const { buildQuery, includeArchive, setIncludeArchive, scope, setScope } =
    useReportShellUrlState({ stripParams: HEAD_STRIP_PARAMS });

  const historyQ = useQuery(
    trpc.reports.compiledHistory.queryOptions({ includeArchive }),
  );

  // History omits the active week; fetch displayed and prepend when missing.
  // Same key as WeeklyReportPage, so RQ dedupes.
  const displayedQ = useQuery(trpc.weeklyReport.get.queryOptions({ reportId }));

  // Active period without reportId so the navigator can always return to it.
  const activeQ = useQuery(trpc.weeklyReport.get.queryOptions({}));

  const periods: ReportPeriod[] = useMemo(
    () =>
      deriveHeadPeriods(
        historyQ.data?.entries ?? [],
        activeQ.data,
        displayedQ.data,
        reportId,
      ),
    [historyQ.data, activeQ.data, displayedQ.data, reportId],
  );

  const urlBuilder = useCallback(
    (periodId: string) =>
      `/head/report/${encodeURIComponent(periodId)}${buildQuery({})}`,
    [buildQuery],
  );

  const editHref = `/head/report/${encodeURIComponent(reportId)}${buildQuery({ mode: null })}`;
  const slidesHref = `/head/report/${encodeURIComponent(reportId)}${buildQuery({ mode: "slides" })}`;

  const reportScope = scope === "lead" ? "lead" : "product";

  // The department context belongs on the page header beside the title because
  // it is a label, while the toolbar contains controls only.
  const headerContextLabel = (
    <ReportToolbarCenterLabel
      label={departmentLabel}
      detail="Live portfolio review"
    />
  );

  // Toolbar hosts the single Agent-review placeholder in both modes.
  const contextControls = (
    <>
      {periods.length > 0 ? (
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
        editHref={editHref}
        slidesHref={slidesHref}
        mode={mode === "slides" ? "slides" : "edit"}
      />
    </>
  );

  // Built here for form mode (passed into WeeklyReportPage); gated on period.
  const displayed = displayedQ.data;
  const exportPdf =
    displayed && displayed.status !== "no-period" ? (
      <ExportPdfButton
        reportId={displayed.reportId}
        periodStatus={displayed.periodStatus}
      />
    ) : undefined;

  // Slides has no WeeklyReportPage; shell owns the context toolbar itself.
  const slidesToolbar = <ReportToolbar contextControls={contextControls} />;

  return (
    <div className="space-y-4">
      {mode === "slides" ? (
        <>
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
          {slidesToolbar}
          <HeadSlidesClient reportId={reportId} scope={reportScope} />
        </>
      ) : (
        <div className="min-w-0">
          <WeeklyReportPage
            reportId={reportId}
            authorId={authorId}
            scope={reportScope}
            documentActionsLeading={exportPdf}
            contextControls={contextControls}
            headerContextLabel={headerContextLabel}
          />
        </div>
      )}
    </div>
  );
}
