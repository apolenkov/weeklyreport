"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";

import { getClientErrorDetails } from "../../../lib/client-error-reporting";
import {
  formatPeriodRangeWithYear,
  isoWeekNumber,
} from "../../../lib/format-date";
import { useTRPC } from "../../../lib/trpc-context";
import { AgentReviewComingSoon } from "../../../shared/ui/report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../../../shared/ui/report-shell/archive-toggle";
import { ReportToolbar } from "../../../shared/ui/report-shell/report-toolbar";
import { ScopeToggle } from "../../../shared/ui/report-shell/scope-toggle";
import { useReportShellUrlState } from "../../../shared/ui/report-shell/use-report-shell-url-state";
import { ViewModeToggle } from "../../../shared/ui/report-shell/view-mode-toggle";
import { ExportPdfButton } from "../../pdf-export";
import { PeriodNavigator } from "../../period";
import type { ReportPeriod } from "../../report-sections";
import { WeeklyReportPage } from "../../report-sections";
import { HeadSlidesClient } from "../../slides";
import {
  deriveViewerAuthority,
  ViewerAuthorityLabel,
} from "./viewer-authority-label";

// Module-scope so the reference is stable across renders — a fresh literal would
// churn the hook's `buildQuery` memoization. The viewer strips the one-shot
// Status-entry markers on every in-shell navigation.
const VIEWER_STRIP_PARAMS: readonly string[] = ["source", "recovery"];

interface ViewerReportShellProps {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly authorId?: string;
}

/**
 * Read-only analogue of `HeadReportShell`, with the same navigation and view
 * controls but no lifecycle mutation. A Status-entry race recovers once through
 * `/reports/latest`; direct and History failures remain terminal.
 */
export function ViewerReportShell({
  reportId,
  mode,
  authorId,
}: ViewerReportShellProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Status recovery markers belong only to the entry URL. Strip them from every
  // in-shell navigation so a later failure cannot be mistaken for that race.
  const { buildQuery, includeArchive, setIncludeArchive, scope, setScope } =
    useReportShellUrlState({ stripParams: VIEWER_STRIP_PARAMS });

  const historyQ = useQuery(
    trpc.reports.compiledHistory.queryOptions({ includeArchive }),
  );
  const displayedQ = useQuery(trpc.weeklyReport.get.queryOptions({ reportId }));

  // The page fetch shares this query key, so handling the fail-closed
  // open-to-published race here is sufficient and avoids duplicate recovery.
  const source = searchParams.get("source");
  const alreadyRetried = searchParams.get("recovery") === "1";
  const isInvalidLink =
    displayedQ.isError && getClientErrorDetails(displayedQ.error).isInvalidLink;
  const shouldRecover = isInvalidLink && source === "status" && !alreadyRetried;

  useEffect(() => {
    if (shouldRecover) {
      router.replace("/reports/latest?recovery=1");
    }
  }, [shouldRecover, router]);

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

    // Prepend the displayed period when the archive toggle hides it from
    // compiledHistory, so the navigator trigger still resolves on this URL.
    const seen = new Set(historyPeriods.map((p) => p.id));
    const displayed = displayedQ.data;
    if (displayed && displayed.status !== "no-period" && !seen.has(reportId)) {
      return [
        {
          id: reportId,
          weekLabel: `Week ${isoWeekNumber(new Date(displayed.periodStart))}`,
          dateRange: formatPeriodRangeWithYear(
            new Date(displayed.periodStart),
            new Date(displayed.periodEnd),
          ),
          archived: false,
          sourceSectionId: "",
          isCurrent: false,
          isSubmitted: true,
        },
        ...historyPeriods,
      ];
    }
    return historyPeriods;
  }, [historyQ.data, displayedQ.data, reportId]);

  const urlBuilder = useCallback(
    (periodId: string) =>
      `/reports/${encodeURIComponent(periodId)}${buildQuery({})}`,
    [buildQuery],
  );

  const editHref = `/reports/${encodeURIComponent(reportId)}${buildQuery({ mode: null })}`;
  const slidesHref = `/reports/${encodeURIComponent(reportId)}${buildQuery({ mode: "slides" })}`;

  const reportScope = scope === "lead" ? "lead" : "product";

  const contextControls = (
    <>
      {periods.length > 0 ? (
        <PeriodNavigator
          periods={periods}
          currentPeriodId={reportId}
          urlBuilder={urlBuilder}
        />
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
        readOnly
      />
    </>
  );

  // Do not flash the terminal notice while the one-shot redirect is in flight.
  if (shouldRecover) {
    return (
      <p
        className="py-16 text-center text-sm text-[var(--color-muted-foreground)]"
        role="status"
      >
        Opening the status report…
      </p>
    );
  }

  const displayed = displayedQ.data;
  const authority =
    displayed && displayed.status !== "no-period"
      ? deriveViewerAuthority(displayed.periodStatus)
      : undefined;
  const headerContextLabel = authority ? (
    <ViewerAuthorityLabel authority={authority} />
  ) : undefined;
  const exportPdf =
    displayed && displayed.status !== "no-period" ? (
      <ExportPdfButton
        reportId={displayed.reportId}
        periodStatus={displayed.periodStatus}
      />
    ) : undefined;

  return (
    <div className="space-y-4">
      {mode === "slides" ? (
        <>
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
                Status Report
              </h1>
              {headerContextLabel}
            </div>
            {exportPdf}
          </header>
          <ReportToolbar contextControls={contextControls} />
          <HeadSlidesClient
            reportId={reportId}
            scope={reportScope}
            enableActivity={false}
          />
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
