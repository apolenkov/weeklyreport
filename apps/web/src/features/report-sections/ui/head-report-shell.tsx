"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useContext, useMemo } from "react";

import {
  formatPeriodRangeWithYear,
  isoWeekNumber,
} from "../../../lib/format-date";
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
import { HeadSlidesClient } from "../../slides";
import type { ReportPeriod } from "../model/types";
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

  // head-toolbar-semantics: the head report view state — scope (Product/Leads)
  // and the show-archived filter — lives in the URL so navigation, refresh, and
  // shared links all restore the selection. `mode` is already a route concern
  // (`?mode=slides`), resolved server-side and passed in as the `mode` prop. The
  // head strips nothing (no one-shot markers), so `stripParams` is empty.
  const { buildQuery, includeArchive, setIncludeArchive, scope, setScope } =
    useReportShellUrlState({ stripParams: HEAD_STRIP_PARAMS });

  const historyQ = useQuery(
    trpc.reports.compiledHistory.queryOptions({ includeArchive }),
  );

  // driver-findings-2026-06-11 finding 4: compiledHistory lists only
  // published + archived periods, so the active week (the one the body shows
  // on `/head/report/<activeId>`) is absent and the navigator falls back to
  // periods[0] (latest published). Fetch the displayed report and prepend it
  // when it is not already in history. Same query key as WeeklyReportPage's
  // identical call, so React Query dedupes — no extra network request.
  const displayedQ = useQuery(trpc.weeklyReport.get.queryOptions({ reportId }));

  // driver-findings-followups item 3: also fetch the CURRENT (active) period
  // independent of the displayed one. Without a reportId the server returns the
  // session's active period, so the navigator can always chevron back to the
  // current week — even from a published week, where the displayed period IS in
  // history and the old code prepended nothing.
  const activeQ = useQuery(trpc.weeklyReport.get.queryOptions({}));

  const periods: ReportPeriod[] = useMemo(() => {
    const entries = historyQ.data?.entries ?? [];
    const historyPeriods: ReportPeriod[] = entries.map((entry) => ({
      id: entry.reportId,
      weekLabel: `Week ${isoWeekNumber(new Date(entry.periodStart))}`,
      dateRange: formatPeriodRangeWithYear(
        new Date(entry.periodStart),
        new Date(entry.periodEnd),
      ),
      archived: entry.archived,
      sourceSectionId: "",
      isCurrent: false,
      isSubmitted: true,
    }));

    // Prepend any period the navigator must reach that compiledHistory (which
    // lists only published + archived weeks) omits: the CURRENT week (so the
    // chevron can always return to it — item 3) and the DISPLAYED week (finding
    // 4: so the trigger resolves on `/head/report/<id>`). Each entry's id MUST
    // be its reportId so the navigator's `p.id === pathReportId` match works.
    const seen = new Set(historyPeriods.map((p) => p.id));
    const toPeriod = (
      id: string,
      data: { periodStart: Date; periodEnd: Date; periodStatus: string },
    ): ReportPeriod => ({
      id,
      weekLabel: `Week ${isoWeekNumber(new Date(data.periodStart))}`,
      dateRange: formatPeriodRangeWithYear(
        new Date(data.periodStart),
        new Date(data.periodEnd),
      ),
      archived: false,
      sourceSectionId: "",
      // Mirror mapWeeklyReport: a non-published period is the current week.
      isCurrent: data.periodStatus !== "published",
      isSubmitted: true,
    });

    const prepended: ReportPeriod[] = [];
    const active = activeQ.data;
    if (active && active.status !== "no-period" && !seen.has(active.reportId)) {
      prepended.push(toPeriod(active.reportId, active));
      seen.add(active.reportId);
    }
    const displayed = displayedQ.data;
    if (displayed && displayed.status !== "no-period" && !seen.has(reportId)) {
      prepended.push(toPeriod(reportId, displayed));
      seen.add(reportId);
    }
    return [...prepended, ...historyPeriods];
  }, [historyQ.data, activeQ.data, displayedQ.data, reportId]);

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

  // Grouping axis for the form-mode status pane (UAT 2026-05-22): product (the
  // classic per-product list) or lead (products bucketed under each lead). Held
  // in the URL (`?scope=lead`) so it survives navigation / refresh — `scope` /
  // `setScope` come from the shared URL-state hook above.
  const reportScope = scope === "lead" ? "lead" : "product";

  // head-toolbar-parity D2: the department context label moved off the toolbar
  // (which is now control-only, two rows) onto the page header line beside the
  // title — it is a label, not a control.
  const headerContextLabel = (
    <ReportToolbarCenterLabel
      label={departmentLabel}
      detail="Live portfolio review"
    />
  );

  // report-toolbar-layout: the head Context-control row (bottom). The inert
  // Agent-review placeholder leads the group (head-toolbar-semantics: compact,
  // leading edge); period navigation, the show-archived filter, and the
  // segmented scope / view-mode toggles follow.
  // head-slides-lead-parity (S6): the slide-header Agent-review slot was removed
  // from the deck, so the toolbar context row now hosts the single placeholder
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

  // report-toolbar-parity: exactly one labeled Export-PDF lives in the shared
  // toolbar's trailing group. In head form mode the rendered toolbar IS this
  // one (passed into WeeklyReportPage's `toolbar` slot), so the export action
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

  // report-toolbar-layout: in slides mode the shell renders the toolbar itself
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
            {/* report-toolbar-layout: the document actions sit on the header
                line, not inside the bordered toolbar. head-surface-uat-polish
                (F1): the per-slide "Open focused report" drill-in link (a
                duplicate of the deck's own slide navigation) was replaced by the
                same Publish & Lock / Reopen action the edit mode offers, so the
                head can lock straight from the review deck. */}
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
