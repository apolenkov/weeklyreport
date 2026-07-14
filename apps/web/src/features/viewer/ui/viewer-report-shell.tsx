"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo } from "react";

import { getClientErrorDetails } from "../../../lib/client-error-reporting";
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
import {
  formatDateRange,
  isoWeekNumber,
  WeeklyReportPage,
  WeeklyReportSkeleton,
} from "../../report-sections";
import { HeadSlidesClient, SlideSkeleton } from "../../slides";

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
  const router = useRouter();
  const searchParams = useSearchParams();

  // viewer-live-status (task 4.3): `source`/`recovery` are one-shot markers the
  // `/reports/latest` redirect places on the FIRST report URL. `stripParams`
  // deletes them on every in-shell navigation (period navigator, scope / archive
  // / view-mode toggles) — otherwise a History selection or a toggle would
  // inherit `source=status`, and a later NOT_FOUND would be misread as a Status
  // navigation and bounce the viewer back to the Status target. They live exactly
  // on the entry redirect, read directly from `searchParams` for the recovery
  // check below.
  const { buildQuery, includeArchive, setIncludeArchive, scope, setScope } =
    useReportShellUrlState({ stripParams: VIEWER_STRIP_PARAMS });

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
