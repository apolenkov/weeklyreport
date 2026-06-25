"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo } from "react";

import { getClientErrorDetails } from "../../lib/client-error-reporting";
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

/**
 * viewer-report-surface-parity (task 5) + viewer-live-status: read-only analogue
 * of `HeadReportShell`. It composes the same `ReportToolbar` primitives —
 * `PeriodNavigator`, `ArchiveToggle`, `ScopeToggle`, `ViewModeToggle`,
 * `ExportPdfButton` — with URL-backed scope (`?scope=lead`) and view-mode
 * (`?mode=slides`), so the viewer gets the same present/slides surface the head
 * has. It OMITS every mutation: there is no `HeadPublishLockAction` and
 * `WeeklyReportPage` already gates Publish/Reopen/Move-to-archive on
 * `canMutatePeriod` (head/admin only), so a viewer never sees them.
 *
 * viewer-live-status (task 5.1): the Back-to-Archive affordance is removed
 * (History lives in the nav, no durable spec governs it); the `Agent-review`
 * coming-soon control is KEPT (the `deferred-feature-pattern` contract mandates
 * exactly one on every report-reading surface, viewer included).
 *
 * viewer-live-status (task 4.3): the read gate is published-or-current and
 * fail-closed, so an `open → published` race yields a `NOT_FOUND` the query
 * client never retries. When that happens AND we arrived from the Status entry
 * (`?source=status&recovery=0`), recover ONCE by redirecting to
 * `/reports/latest?recovery=1`, which re-resolves to the published snapshot. A
 * `NOT_FOUND` carrying `recovery=1`, or any without `source=status` (History /
 * a directly-typed id), shows the terminal notice without redirecting (loop
 * guard).
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

  // viewer-live-status (task 4.3): one-shot race recovery. A published-or-current
  // gate rejection (the open→published flip) surfaces here as an invalid-link
  // NOT_FOUND. Recover ONCE when we arrived from the Status entry and have not
  // yet retried (`source=status`, `recovery` defaulting to 0). The flag set to
  // `1` on the re-resolution bars a redirect loop; a direct/History NOT_FOUND
  // (no `source=status`) falls through to the terminal notice unchanged. The
  // redirect lives in ONE place (here) — `WeeklyReportPage`'s own fetch shares
  // this query key, so React Query dedupes it; intercepting once is enough.
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
        readOnly
      />
    </>
  );

  // viewer-live-status (task 4.3): while the one-shot recovery redirect is in
  // flight, short-circuit to a resolving state so the terminal "Report not
  // found" notice from `WeeklyReportPage` never flashes before the navigation.
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
