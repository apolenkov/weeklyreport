"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo } from "react";

import { formatDateRange, isoWeekNumber } from "../../lib/mappers/lead-history";
import { useTRPC } from "../../lib/trpc-context";
import type { ReportPeriod } from "../lead/mock-data";
import { PeriodNavigator } from "../lead/period-navigator";
import { AgentReviewComingSoon } from "../report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../report-shell/archive-toggle";
import { ReportToolbar } from "../report-shell/report-toolbar";
import { ScopeToggle, type ScopeValue } from "../report-shell/scope-toggle";
import { ViewModeToggle } from "../report-shell/view-mode-toggle";
import { HeadSlidesClient } from "../slides/head-slides-client";
import { SlideSkeleton } from "../slides/slide-skeleton";
import { ExportPdfButton } from "../weekly-report/export-pdf-button";
import { WeeklyReportPage } from "../weekly-report/weekly-report-page";
import { WeeklyReportSkeleton } from "../weekly-report/weekly-report-skeleton";

interface ViewerReportShellProps {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly authorId?: string;
}

const ARCHIVE_HREF = "/reports?tab=published";

/**
 * viewer-report-surface-parity (task 5): read-only analogue of
 * `HeadReportShell`. It composes the same `ReportToolbar` primitives —
 * `PeriodNavigator`, `ArchiveToggle`, `ScopeToggle`, `ViewModeToggle`,
 * `ExportPdfButton` — with URL-backed scope (`?scope=lead`) and view-mode
 * (`?mode=slides`), so the viewer gets the same present/slides surface the head
 * has. It OMITS every mutation: there is no `HeadPublishLockAction` and
 * `WeeklyReportPage` already gates Publish/Reopen/Move-to-archive on
 * `canMutatePeriod` (head/admin only), so a viewer never sees them.
 *
 * Unlike the head shell it does NOT fetch the active period (a viewer's active
 * period is unpublished → `weeklyReport.get` 404s for a viewer); every report a
 * viewer can open is published and therefore already in `compiledHistory`. The
 * displayed report is prepended only if the archive toggle hides it.
 *
 * The Back-to-Archive + Agent-review affordances that the standalone viewer page
 * carried in `contextControlsLeading` are preserved here inside the full
 * Context-control row (the two slots are mutually exclusive).
 */
export function ViewerReportShell({
  reportId,
  mode,
  authorId,
}: ViewerReportShellProps) {
  const trpc = useTRPC();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const buildQuery = useCallback(
    (overrides: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(overrides)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      return qs ? `?${qs}` : "";
    },
    [searchParams],
  );

  const includeArchive = searchParams.get("archive") === "1";
  const setIncludeArchive = useCallback(
    (value: boolean) => {
      router.replace(
        `${pathname}${buildQuery({ archive: value ? "1" : null })}`,
        { scroll: false },
      );
    },
    [router, pathname, buildQuery],
  );

  const historyQ = useQuery(
    trpc.reports.compiledHistory.queryOptions({ includeArchive }),
  );
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

    // Prepend the displayed period when the archive toggle hides it from
    // compiledHistory, so the navigator trigger still resolves on this URL.
    const seen = new Set(historyPeriods.map((p) => p.id));
    const displayed = displayedQ.data;
    if (displayed && displayed.status !== "no-period" && !seen.has(reportId)) {
      return [
        {
          id: reportId,
          weekLabel: `Week ${isoWeekNumber(new Date(displayed.periodStart))}`,
          dateRange: formatDateRange(
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

  const scope: ScopeValue =
    searchParams.get("scope") === "lead" ? "lead" : "product";
  const setScope = useCallback(
    (value: ScopeValue) => {
      router.replace(
        `${pathname}${buildQuery({ scope: value === "lead" ? "lead" : null })}`,
        { scroll: false },
      );
    },
    [router, pathname, buildQuery],
  );
  const reportScope = scope === "lead" ? "lead" : "product";

  const backToArchive = (
    <a
      href={ARCHIVE_HREF}
      className="btn-press inline-flex min-h-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)]"
      aria-label="Back to Archive"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span>Back to Archive</span>
    </a>
  );

  const contextControls = (
    <>
      {periods.length > 0 ? (
        <PeriodNavigator periods={periods} urlBuilder={urlBuilder} />
      ) : null}
      <ArchiveToggle checked={includeArchive} onChange={setIncludeArchive} />
      <div className="grow" aria-hidden="true" />
      <AgentReviewComingSoon compact />
      {backToArchive}
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

  const displayed = displayedQ.data;
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
            <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
              Status Report
            </h1>
            {exportPdf}
          </header>
          <ReportToolbar contextControls={contextControls} />
          <Suspense fallback={<SlideSkeleton />}>
            <HeadSlidesClient
              reportId={reportId}
              scope={reportScope}
              enableActivity={false}
            />
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
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
