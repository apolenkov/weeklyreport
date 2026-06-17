"use client";

import { useQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useContext, useMemo, useState } from "react";

import { formatDateRange, isoWeekNumber } from "../../lib/mappers/lead-history";
import { SessionContext } from "../../lib/session-provider";
import { useTRPC } from "../../lib/trpc-context";
import type { ReportPeriod } from "../lead/mock-data";
import { PeriodNavigator } from "../lead/period-navigator";
import { AgentReviewComingSoon } from "../report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../report-shell/archive-toggle";
import {
  ReportToolbar,
  ReportToolbarCenterLabel,
} from "../report-shell/report-toolbar";
import { ScopeToggle, type ScopeValue } from "../report-shell/scope-toggle";
import { ViewModeToggle } from "../report-shell/view-mode-toggle";
import { HeadSlidesClient } from "../slides/head-slides-client";
import { SlideSkeleton } from "../slides/slide-skeleton";
import { ExportPdfButton } from "../weekly-report/export-pdf-button";
import { WeeklyReportPage } from "../weekly-report/weekly-report-page";
import { WeeklyReportSkeleton } from "../weekly-report/weekly-report-skeleton";

interface HeadReportShellProps {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly authorId?: string;
}

/**
 * Phase 61 (robust-baking-aurora): inline form ↔ slides mode toggle for the
 * head status report page. Mirrors the pattern from lead-form.tsx.
 * UAT 2026-05-22 (done-condition 10): added period navigator + archive toggle
 * parity with the lead report toolbar. Head remains read-only — no version
 * browsing, no section editing.
 */
export function HeadReportShell({
  reportId,
  mode,
  authorId,
}: HeadReportShellProps) {
  const trpc = useTRPC();

  // head-toolbar-parity D2: the department label moved here from the
  // WeeklyReportPage context bar the shell now suppresses. Same source:
  // the Organization singleton's fullName from auth.me (UFB-047).
  const sessionState = useContext(SessionContext);
  const departmentLabel =
    sessionState?.organization?.fullName ?? "CustomReport";

  const [includeArchive, setIncludeArchive] = useState(false);

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
      dateRange: formatDateRange(
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
      dateRange: formatDateRange(
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

  const urlBuilder = useCallback(
    (periodId: string) => {
      const base = `/head/report/${encodeURIComponent(periodId)}`;
      if (mode === "slides") return `${base}?mode=slides`;
      if (authorId) return `${base}?authorId=${encodeURIComponent(authorId)}`;
      return base;
    },
    [mode, authorId],
  );

  const authorSuffix = authorId
    ? `?authorId=${encodeURIComponent(authorId)}`
    : "";
  const editHref = `/head/report/${encodeURIComponent(reportId)}${authorSuffix}`;
  const slidesHref = `/head/report/${encodeURIComponent(reportId)}?mode=slides${
    authorId ? `&authorId=${encodeURIComponent(authorId)}` : ""
  }`;

  // Grouping axis for the form-mode status pane (UAT 2026-05-22): product (the
  // classic per-product list) or lead (products bucketed under each lead).
  const [scope, setScope] = useState<ScopeValue>("product");
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
  // one-placeholder-per-surface (mount-agent-review-placeholder): slides mode
  // already carries an Agent-review placeholder inside the head slide deck
  // (status-slide-deck.tsx), so the context row only mounts one in form mode to
  // avoid double-mounting on the slides surface.
  const contextControls = (
    <>
      {mode === "form" ? <AgentReviewComingSoon /> : null}
      {periods.length > 0 ? (
        <PeriodNavigator periods={periods} urlBuilder={urlBuilder} />
      ) : null}
      <ArchiveToggle checked={includeArchive} onChange={setIncludeArchive} />
      <ScopeToggle
        value={scope}
        onChange={setScope}
        allowedScopes={["product", "lead"]}
      />
      <ViewModeToggle editHref={editHref} slidesHref={slidesHref} />
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

  // report-toolbar-layout: in slides mode the shell renders the page's single
  // two-row ReportToolbar itself (slides has no WeeklyReportPage). The top
  // Document action row carries the labeled Export-PDF; the bottom Context
  // control row carries the period nav + scope / view-mode toggles. Publish &
  // Lock is a form-mode page action and is absent here, as before.
  const slidesToolbar = (
    <ReportToolbar
      documentActions={exportPdf}
      contextControls={contextControls}
    />
  );

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
          </header>
          {slidesToolbar}
          <Suspense fallback={<SlideSkeleton />}>
            <HeadSlidesClient reportId={reportId} scope={reportScope} />
          </Suspense>
        </>
      ) : (
        <div className="min-w-0">
          <Suspense fallback={<WeeklyReportSkeleton />}>
            <WeeklyReportPage
              reportId={reportId}
              authorId={authorId}
              scope={reportScope}
              documentActionsLeading={exportPdf}
              contextControls={contextControls}
              headerContextLabel={headerContextLabel}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
