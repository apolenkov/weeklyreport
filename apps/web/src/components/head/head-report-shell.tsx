"use client";

import { useQuery } from "@tanstack/react-query";
import { FileDown, Presentation } from "lucide-react";
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

    // Prepend the displayed (active) period when history does not already
    // carry it. The entry's id MUST be the reportId so the navigator's
    // `p.id === pathReportId` match resolves the addressed week.
    const displayed = displayedQ.data;
    if (
      !displayed ||
      displayed.status === "no-period" ||
      historyPeriods.some((p) => p.id === reportId)
    ) {
      return historyPeriods;
    }
    const activePeriod: ReportPeriod = {
      id: reportId,
      weekLabel: `Week ${isoWeekNumber(new Date(displayed.periodStart))}`,
      dateRange: formatDateRange(
        new Date(displayed.periodStart),
        new Date(displayed.periodEnd),
      ),
      archived: false,
      sourceSectionId: "",
      // Mirror mapWeeklyReport: a non-published period is the current week.
      isCurrent: displayed.periodStatus !== "published",
      isSubmitted: true,
    };
    return [activePeriod, ...historyPeriods];
  }, [historyQ.data, displayedQ.data, reportId]);

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

  const presentHref = `/head/report/${encodeURIComponent(reportId)}/present`;
  const printHref = `/print/${encodeURIComponent(reportId)}`;

  // Single period toolbar (UAT 2026-05-22 done-condition 10 +
  // head-toolbar-parity D2): period navigator + archive toggle so head can
  // switch between published weeks. The shell composes the page's ONE
  // ReportToolbar; in form mode WeeklyReportPage renders it through its
  // `toolbar` slot, below the real page header row (h1 + publish actions) —
  // the lead arrangement. That slot replaces the page's own context bar, and
  // the department label renders here in the center slot instead.
  const reportToolbar = (
    <ReportToolbar
      periodNavigator={
        periods.length > 0 ? (
          <PeriodNavigator periods={periods} urlBuilder={urlBuilder} />
        ) : undefined
      }
      archiveToggle={
        <ArchiveToggle checked={includeArchive} onChange={setIncludeArchive} />
      }
      leadingExtras={
        <ReportToolbarCenterLabel
          label={departmentLabel}
          detail="Live portfolio review"
        />
      }
    />
  );

  return (
    <div className="space-y-4">
      {/* Action row parity with the lead report header (UAT 2026-05-22,
          done-condition 10): head is read-only, so the lead Submit slot is
          replaced by export / presentation actions.
          head-toolbar-parity D2: this utility row comes first; in form mode
          the single pill toolbar renders below the real page header row
          inside WeeklyReportPage (via its toolbar slot) — the lead
          arrangement.
          polish-ui-density T3 + unify-head-toolbar-controls: real controls
          share one height (--touch-target-min), grouped by intent —
          scope | view mode (primary) | utilities — with wider gaps between
          groups. The inert Agent review placeholder is compact and trails
          the group (documented ui-control-density exception). It mounts in
          form mode only: slides mode already carries one inside the head
          slide article (status-slide-deck.tsx), and one placeholder per
          surface is the deferred-feature-pattern invariant
          (mount-agent-review-placeholder). */}
      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
        <ScopeToggle
          value={scope}
          onChange={setScope}
          allowedScopes={["product", "lead"]}
        />
        <ViewModeToggle editHref={editHref} slidesHref={slidesHref} />
        <div className="flex items-center gap-2">
          <a
            href={presentHref}
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
            title="Open presentation"
          >
            <Presentation className="h-4 w-4" aria-hidden="true" />
            <span>Present</span>
          </a>
          <a
            href={printHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--color-starbucks-accent)] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
            title="Print report (browser print)"
          >
            <FileDown className="h-4 w-4" aria-hidden="true" />
            <span>Print</span>
          </a>
          {mode === "form" ? <AgentReviewComingSoon compact /> : null}
        </div>
      </div>
      {mode === "slides" ? (
        <>
          {/* Slides mode has no WeeklyReportPage header, so the shell renders
              the toolbar directly above the deck. */}
          {reportToolbar}
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
              toolbar={reportToolbar}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
