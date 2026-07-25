"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo } from "react";

import { getClientErrorDetails } from "../../../lib/client-error-reporting";
import { useTRPC } from "../../../lib/trpc-context";
import { ReportToolbar } from "../../../shared/ui/report-shell/report-toolbar";
import { useReportShellUrlState } from "../../../shared/ui/report-shell/use-report-shell-url-state";
import { ExportPdfButton } from "../../pdf-export";
import { WeeklyReportPage } from "../../report-pages";
import { HeadSlidesClient } from "../../slides";
import { deriveViewerPeriods } from "./derive-viewer-periods";
import {
  deriveViewerAuthority,
  ViewerAuthorityLabel,
} from "./viewer-authority-label";
import { ViewerContextControls } from "./viewer-context-controls";

// Module-scope so the reference is stable across renders — a fresh literal would
// churn the hook's `buildQuery` memoization. The viewer strips the one-shot
// Status-entry markers on every in-shell navigation.
const VIEWER_STRIP_PARAMS: readonly string[] = ["source", "recovery"];

interface ViewerReportShellProps {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly authorId?: string;
}

// Shown only while the one-shot /reports/latest redirect is in flight, so the
// terminal "invalid link" notice never flashes during recovery.
function ViewerRecoveryNotice() {
  return (
    <p
      className="py-16 text-center text-sm text-[var(--color-muted-foreground)]"
      role="status"
    >
      Opening the status report…
    </p>
  );
}

function ViewerSlidesView({
  reportId,
  reportScope,
  headerContextLabel,
  exportPdf,
  contextControls,
}: {
  readonly reportId: string;
  readonly reportScope: "lead" | "product";
  readonly headerContextLabel: ReactNode;
  readonly exportPdf: ReactNode;
  readonly contextControls: ReactNode;
}) {
  return (
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
  );
}

// Status-entry race recovers once via /reports/latest; direct/History failures are terminal.
/**
 * Viewer Report Shell.
 * @param props - The props argument.
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

  const periods = useMemo(
    () =>
      deriveViewerPeriods(historyQ.data?.entries, displayedQ.data, reportId),
    [historyQ.data, displayedQ.data, reportId],
  );

  const urlBuilder = useCallback(
    (periodId: string) =>
      `/reports/${encodeURIComponent(periodId)}${buildQuery({})}`,
    [buildQuery],
  );

  const editHref = `/reports/${encodeURIComponent(reportId)}${buildQuery({ mode: null })}`;
  const slidesHref = `/reports/${encodeURIComponent(reportId)}${buildQuery({ mode: "slides" })}`;

  const reportScope = scope === "lead" ? "lead" : "product";

  const contextControls = (
    <ViewerContextControls
      periods={periods}
      reportId={reportId}
      urlBuilder={urlBuilder}
      includeArchive={includeArchive}
      setIncludeArchive={setIncludeArchive}
      scope={scope}
      setScope={setScope}
      editHref={editHref}
      slidesHref={slidesHref}
      mode={mode}
    />
  );

  if (shouldRecover) {
    return <ViewerRecoveryNotice />;
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
        <ViewerSlidesView
          reportId={reportId}
          reportScope={reportScope}
          headerContextLabel={headerContextLabel}
          exportPdf={exportPdf}
          contextControls={contextControls}
        />
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
