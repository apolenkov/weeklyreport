"use client";

import { useQuery } from "@tanstack/react-query";
import type { WeeklyReportGetResponse } from "@weeklyreport/shared";
import { Skeleton } from "@weeklyreport/ui/components/ui/skeleton";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { isLead } from "../../../shared/lib/auth/role-predicates";
import { useSession } from "../../../shared/lib/auth/session-provider";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import {
  DocumentActionGroup,
  ReportToolbar,
} from "../../../shared/ui/report-shell/report-toolbar";
import { useReportShellUrlState } from "../../../shared/ui/report-shell/use-report-shell-url-state";
import { ExportPdfButton } from "../../pdf-export";
import { WeeklyReportPage } from "../../report-pages";
import { HeadSlidesClient } from "../../slides";
import { deriveViewerPeriods } from "./derive-viewer-periods";
import {
  useStatusEntryRecovery,
  VIEWER_STRIP_PARAMS,
} from "./use-status-entry-recovery";
import {
  deriveViewerAuthority,
  ViewerAuthorityLabel,
} from "./viewer-authority-label";
import { ViewerShellControls } from "./viewer-shell-controls";

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
  readonly isLoading: boolean;
}

function ViewerAuthoritySkeleton() {
  return (
    <div
      data-testid="viewer-authority-skeleton"
      className="flex min-w-0 flex-wrap items-center gap-2"
      aria-hidden="true"
    >
      <Skeleton className="h-4 w-52" />
      <Skeleton className="h-6 w-20 rounded-[var(--radius-pill)]" />
    </div>
  );
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
      <header
        data-layout-key="weekly-report-header"
        data-layout-stability="position-size"
        className="flex min-h-32 flex-wrap items-center justify-between gap-4 sm:min-h-0"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
            Status Report
          </h1>
          {chrome.isLoading ? (
            <ViewerAuthoritySkeleton />
          ) : (
            chrome.headerContextLabel
          )}
        </div>
        <DocumentActionGroup>
          {chrome.isLoading ? (
            <Skeleton
              data-testid="viewer-document-action-skeleton"
              className="h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] rounded-[var(--radius-pill)]"
            />
          ) : (
            chrome.exportPdf
          )}
        </DocumentActionGroup>
      </header>
      <ReportToolbar
        contextControls={chrome.contextControls}
        layoutKey="report-context-toolbar"
      />
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
    <div
      className="space-y-4"
      data-layout-key={mode === "slides" ? "report-page" : undefined}
      data-layout-stability={mode === "slides" ? "position-width" : undefined}
    >
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
            loadingAudience="viewer"
          />
        </div>
      )}
    </div>
  );
}

// A no-period response carries neither an authority state nor an exportable
// reportId, so both chrome slots stay empty for it.
function deriveViewerDisplay(
  displayed: WeeklyReportGetResponse | undefined,
  canExportPdf: boolean,
  mode: ViewerReportShellProps["mode"],
): {
  readonly headerContextLabel: ReactNode;
  readonly exportPdf: ReactNode;
} {
  if (!displayed || displayed.status === "no-period") {
    return { headerContextLabel: undefined, exportPdf: undefined };
  }
  return {
    headerContextLabel:
      mode === "form" && displayed.periodStatus === "published" ? undefined : (
        <ViewerAuthorityLabel
          authority={deriveViewerAuthority(displayed.periodStatus)}
        />
      ),
    exportPdf: canExportPdf ? (
      <ExportPdfButton
        reportId={displayed.reportId}
        periodStatus={displayed.periodStatus}
      />
    ) : undefined,
  };
}

export function ViewerReportShell({
  reportId,
  mode,
  authorId,
}: ViewerReportShellProps) {
  const trpc = useTRPC();
  const { user } = useSession();

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

  // The mounted form/slides child reports ordinary displayedQ failures. The
  // shell owns only the recovery failure, where it replaces that child.
  useQueryErrorHandler(historyQ, {
    event: "viewerReport.compiledHistory.load_failed",
    component: "ViewerReportShell",
    procedure: "reports.compiledHistory",
  });
  useQueryErrorHandler(
    {
      isError: shouldRecover && displayedQ.isError,
      isSuccess: displayedQ.isSuccess,
      error: displayedQ.error,
    },
    {
      event: "viewerReport.get.load_failed",
      component: "ViewerReportShell",
      procedure: "weeklyReport.get",
    },
  );

  const periods = useMemo(
    () =>
      deriveViewerPeriods(historyQ.data?.entries, displayedQ.data, reportId),
    [historyQ.data, displayedQ.data, reportId],
  );

  if (shouldRecover) {
    return <ViewerRecoveryNotice />;
  }

  const chrome: ViewerChrome = {
    ...deriveViewerDisplay(
      displayedQ.data,
      user !== null && !isLead(user.role),
      mode,
    ),
    isLoading: displayedQ.isLoading,
    contextControls: (
      <ViewerShellControls
        reportId={reportId}
        mode={mode}
        periods={periods}
        urlState={urlState}
        historyError={historyQ.isError}
        historyTruncated={historyQ.data?.truncated === true}
        historyLoading={historyQ.isLoading}
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
