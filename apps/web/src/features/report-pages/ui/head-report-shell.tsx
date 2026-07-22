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

/**
 * Inline form ↔ slides mode toggle for the head status report page, with a
 * period navigator + archive toggle matching the lead report toolbar. Head
 * remains read-only — no version browsing, no section editing.
 */
export function HeadReportShell({
  reportId,
  mode,
  authorId,
}: HeadReportShellProps) {
  const trpc = useTRPC();

  // The department label is the Organization singleton's fullName from auth.me;
  // the shell suppresses the WeeklyReportPage context bar that would otherwise
  // carry it, so it is surfaced here instead.
  const sessionState = useContext(SessionContext);
  const departmentLabel =
    sessionState?.organization?.fullName ?? "CustomReport";

  // Scope and the show-archived filter live in the URL so navigation, refresh, and
  // shared links all restore the selection. `mode` is already a route concern
  // (`?mode=slides`), resolved server-side and passed in as the `mode` prop. The
  // head strips nothing (no one-shot markers), so `stripParams` is empty.
  const { buildQuery, includeArchive, setIncludeArchive, scope, setScope } =
    useReportShellUrlState({ stripParams: HEAD_STRIP_PARAMS });

  const historyQ = useQuery(
    trpc.reports.compiledHistory.queryOptions({ includeArchive }),
  );

  // Compiled history lists only published and archived periods, so the active
  // week shown on `/head/report/<activeId>` is absent and the navigator falls back to
  // periods[0] (latest published). Fetch the displayed report and prepend it
  // when it is not already in history. Same query key as WeeklyReportPage's
  // identical call, so React Query dedupes — no extra network request.
  const displayedQ = useQuery(trpc.weeklyReport.get.queryOptions({ reportId }));

  // Fetch the current active period independently of the displayed one. Without
  // a reportId the server returns the session's active period, so the navigator
  // can always chevron back to the current week — even when the displayed
  // period is itself a published, historical one.
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

  // Period navigation preserves the current view state (mode, authorId, scope,
  // show-archived) — all already live in the URL, so `buildQuery({})` carries
  // them onto the next period's URL unchanged.
  const urlBuilder = useCallback(
    (periodId: string) =>
      `/head/report/${encodeURIComponent(periodId)}${buildQuery({})}`,
    [buildQuery],
  );

  // The view-mode toggle only flips `mode`; every other view param (authorId,
  // scope, show-archived) is preserved so switching Edit↔Slides keeps state.
  const editHref = `/head/report/${encodeURIComponent(reportId)}${buildQuery({ mode: null })}`;
  const slidesHref = `/head/report/${encodeURIComponent(reportId)}${buildQuery({ mode: "slides" })}`;

  // The form-mode status pane groups by product or by lead. The selection stays
  // in the URL (`?scope=lead`) so it survives navigation / refresh — `scope` /
  // `setScope` come from the shared URL-state hook above.
  const reportScope = scope === "lead" ? "lead" : "product";

  // The department context belongs on the page header beside the title because
  // it is a label, while the toolbar contains controls only.
  const headerContextLabel = (
    <ReportToolbarCenterLabel
      label={departmentLabel}
      detail="Live portfolio review"
    />
  );

  // The context row carries period navigation, the archive filter, the inert
  // Agent-review placeholder, and the scope and view-mode toggles. The deck has
  // no separate Agent-review slot, so the toolbar hosts the single placeholder
  // in BOTH form and slides mode — exactly one per surface, no double-mount.
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

  // Exactly one labeled Export-PDF lives in the shared toolbar's trailing group.
  // In head form mode this toolbar is passed into WeeklyReportPage, so the action
  // must be built here. It renders only for a resolvable active period, with
  // the displayed period's lifecycle status driving its enabled state.
  const displayed = displayedQ.data;
  const exportPdf =
    displayed && displayed.status !== "no-period" ? (
      <ExportPdfButton
        reportId={displayed.reportId}
        periodStatus={displayed.periodStatus}
      />
    ) : undefined;

  // In slides mode the shell renders the toolbar itself
  // (slides has no WeeklyReportPage). The bordered toolbar carries only the
  // Context-control bar (period nav + scope / view-mode toggles); the labeled
  // Export-PDF document action lives on the slides header line below. Publish &
  // Lock is a form-mode page action and is absent here, as before.
  const slidesToolbar = <ReportToolbar contextControls={contextControls} />;

  return (
    <div className="space-y-4">
      {mode === "slides" ? (
        <>
          {/* Slides mode has no WeeklyReportPage header, so the shell renders
              the lead-style page header directly above the toolbar and deck. */}
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div className="min-w-0">
                <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
                  Status Report
                </h1>
              </div>
              {headerContextLabel}
            </div>
            {/* Document actions sit on the header line, not inside the bordered
                toolbar. The deck already provides focused-report navigation, so
                this slot exposes the Publish & Lock / Reopen action and lets the
                head lock directly from the review deck. */}
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
