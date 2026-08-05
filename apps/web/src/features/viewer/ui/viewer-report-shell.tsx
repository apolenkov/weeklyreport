"use client";

import type { WeeklyReportGetResponse } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";

import { getClientErrorDetails } from "../../../shared/lib/errors/client-error-reporting";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
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
import { ViewerShellControls } from "./viewer-shell-controls";

// Module-scope so the reference is stable across renders — a fresh literal would
// churn the hook's `buildQuery` memoization. The viewer strips the one-shot
// Status-entry markers on every in-shell navigation.
const VIEWER_STRIP_PARAMS: readonly string[] = ["source", "recovery"];

interface ViewerReportShellProps {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly authorId?: string | undefined;
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

interface ViewerChrome {
  readonly headerContextLabel: ReactNode;
  readonly exportPdf: ReactNode;
  readonly contextControls: ReactNode;
}

function ViewerSlidesView({
  reportId,
  reportScope,
  chrome,
}: {
  readonly reportId: string;
  readonly reportScope: "lead" | "product";
  readonly chrome: ViewerChrome;
}) {
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            Status Report
          </h1>
          {chrome.headerContextLabel}
        </div>
        {chrome.exportPdf}
      </header>
      <ReportToolbar contextControls={chrome.contextControls} />
      <HeadSlidesClient
        reportId={reportId}
        scope={reportScope}
        enableActivity={false}
      />
    </>
  );
}

function ViewerReportBody({
  reportId,
  mode,
  authorId,
  reportScope,
  chrome,
}: {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly authorId: string | undefined;
  readonly reportScope: "lead" | "product";
  readonly chrome: ViewerChrome;
}) {
  return (
    <div className="space-y-4">
      {mode === "slides" ? (
        <ViewerSlidesView
          reportId={reportId}
          reportScope={reportScope}
          chrome={chrome}
        />
      ) : (
        <div className="min-w-0">
          <WeeklyReportPage
            reportId={reportId}
            authorId={authorId}
            scope={reportScope}
            documentActionsLeading={chrome.exportPdf}
            contextControls={chrome.contextControls}
            headerContextLabel={chrome.headerContextLabel}
          />
        </div>
      )}
    </div>
  );
}

// Status-entry race recovers once via /reports/latest; direct/History failures
// are terminal. The page fetch shares this query key, so recovering here is
// sufficient and avoids a duplicate redirect.
function useStatusEntryRecovery(displayedQuery: {
  readonly isError: boolean;
  readonly error: unknown;
}): boolean {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isInvalidLink =
    displayedQuery.isError &&
    getClientErrorDetails(displayedQuery.error).isInvalidLink;
  const shouldRecover =
    isInvalidLink &&
    searchParams.get("source") === "status" &&
    searchParams.get("recovery") !== "1";

  useEffect(() => {
    if (shouldRecover) {
      router.replace("/reports/latest?recovery=1");
    }
  }, [shouldRecover, router]);

  return shouldRecover;
}

// A no-period response carries neither an authority state nor an exportable
// reportId, so both chrome slots stay empty for it.
function deriveViewerDisplay(displayed: WeeklyReportGetResponse | undefined): {
  readonly headerContextLabel: ReactNode;
  readonly exportPdf: ReactNode;
} {
  if (!displayed || displayed.status === "no-period") {
    return { headerContextLabel: undefined, exportPdf: undefined };
  }
  return {
    headerContextLabel: (
      <ViewerAuthorityLabel
        authority={deriveViewerAuthority(displayed.periodStatus)}
      />
    ),
    exportPdf: (
      <ExportPdfButton
        reportId={displayed.reportId}
        periodStatus={displayed.periodStatus}
      />
    ),
  };
}

export function ViewerReportShell({
  reportId,
  mode,
  authorId,
}: ViewerReportShellProps) {
  const trpc = useTRPC();

  // Status recovery markers belong only to the entry URL. Strip them from every
  // in-shell navigation so a later failure cannot be mistaken for that race.
  const urlState = useReportShellUrlState({ stripParams: VIEWER_STRIP_PARAMS });

  const historyQ = useQuery(
    trpc.reports.compiledHistory.queryOptions({
      includeArchive: urlState.includeArchive,
    }),
  );
  const displayedQ = useQuery(trpc.weeklyReport.get.queryOptions({ reportId }));

  const shouldRecover = useStatusEntryRecovery(displayedQ);

  const periods = useMemo(
    () =>
      deriveViewerPeriods(historyQ.data?.entries, displayedQ.data, reportId),
    [historyQ.data, displayedQ.data, reportId],
  );

  if (shouldRecover) {
    return <ViewerRecoveryNotice />;
  }

  const chrome: ViewerChrome = {
    ...deriveViewerDisplay(displayedQ.data),
    contextControls: (
      <ViewerShellControls
        reportId={reportId}
        mode={mode}
        periods={periods}
        urlState={urlState}
        historyError={historyQ.isError}
      />
    ),
  };

  return (
    <ViewerReportBody
      reportId={reportId}
      mode={mode}
      authorId={authorId}
      reportScope={urlState.scope === "lead" ? "lead" : "product"}
      chrome={chrome}
    />
  );
}
