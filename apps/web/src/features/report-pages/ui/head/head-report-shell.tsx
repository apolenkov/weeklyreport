"use client";

import type { WeeklyReportGetResponse } from "@customreport/shared";
import { useQuery } from "@tanstack/react-query";
import { type RefObject, useMemo, useRef } from "react";

import { useFullscreen } from "../../../../shared/hooks/browser/use-fullscreen";
import { useTRPC } from "../../../../shared/lib/trpc/trpc-context";
import { ReportToolbar } from "../../../../shared/ui/report-shell/report-toolbar";
import {
  type ReportShellScopeValue,
  useReportShellUrlState,
} from "../../../../shared/ui/report-shell/use-report-shell-url-state";
import { ExportPdfButton } from "../../../pdf-export";
import { deriveHeadPeriods } from "../../../period";
import type { ReportPeriod } from "../../../report-sections";
import { DeckToolbarControls, HeadSlidesClient } from "../../../slides";
import { WeeklyReportPage } from "../weekly/weekly-report-page";
import {
  HEAD_DEPARTMENT_LABEL,
  HeadContextControls,
  type HeadReportMode,
  SlidesModeHeader,
} from "./head-report-chrome";

// Module-scope so the reference is stable across renders — a fresh literal would
// churn the hook's `buildQuery` memoization. The head strips no one-shot markers.
const HEAD_STRIP_PARAMS: readonly string[] = [];

interface HeadReportShellProps {
  readonly reportId: string;
  readonly mode: HeadReportMode;
  readonly authorId?: string | undefined;
}

// History omits the active week, so the displayed and active periods are fetched
// separately and prepended. Both use WeeklyReportPage's key, so RQ dedupes; the
// active fetch carries no reportId so the navigator can always return to it.
function useHeadPeriodData(reportId: string, includeArchive: boolean) {
  const trpc = useTRPC();
  const historyQ = useQuery(
    trpc.reports.compiledHistory.queryOptions({ includeArchive }),
  );
  const displayedQ = useQuery(trpc.weeklyReport.get.queryOptions({ reportId }));
  const activeQ = useQuery(trpc.weeklyReport.get.queryOptions({}));

  const periods: readonly ReportPeriod[] = useMemo(
    () =>
      deriveHeadPeriods(
        historyQ.data?.entries ?? [],
        activeQ.data,
        displayedQ.data,
        reportId,
      ),
    [historyQ.data, activeQ.data, displayedQ.data, reportId],
  );

  return {
    periods,
    displayed: displayedQ.data,
    historyError: historyQ.isError,
    isLoading: historyQ.isLoading || displayedQ.isLoading || activeQ.isLoading,
  };
}

// `undefined` (not a null-rendering element) when there is no period, so the
// action groups receive no child at all.
function renderExportPdf(
  displayed: WeeklyReportGetResponse | undefined,
): React.ReactNode {
  if (!displayed || displayed.status === "no-period") return undefined;
  return (
    <ExportPdfButton
      reportId={displayed.reportId}
      periodStatus={displayed.periodStatus}
    />
  );
}

interface HeadReportBodyProps extends HeadReportShellProps {
  readonly scope: ReportShellScopeValue;
  readonly deckRef: RefObject<HTMLDivElement | null>;
  readonly fullscreenToggleRef: RefObject<HTMLButtonElement | null>;
  readonly isFullscreen: boolean;
  readonly onToggleFullscreen: () => void;
  readonly isLoading: boolean;
  readonly exportPdf: React.ReactNode;
  readonly contextControls: React.ReactNode;
}

function HeadReportBody(props: HeadReportBodyProps) {
  return (
    <div
      className="space-y-4"
      data-layout-key={props.mode === "slides" ? "report-page" : undefined}
      data-layout-stability={
        props.mode === "slides" ? "position-width" : undefined
      }
    >
      {props.mode === "slides" ? (
        <>
          <SlidesModeHeader
            reportId={props.reportId}
            headerContextLabel={HEAD_DEPARTMENT_LABEL}
            exportPdf={props.exportPdf}
            isLoading={props.isLoading}
          />
          <ReportToolbar
            contextControls={props.contextControls}
            layoutKey="report-context-toolbar"
          />
          <HeadSlidesClient
            reportId={props.reportId}
            scope={props.scope}
            deckRef={props.deckRef}
            fullscreenToggleRef={props.fullscreenToggleRef}
            isFullscreen={props.isFullscreen}
            onToggle={props.onToggleFullscreen}
          />
        </>
      ) : (
        <div className="min-w-0">
          <WeeklyReportPage
            reportId={props.reportId}
            authorId={props.authorId}
            scope={props.scope}
            documentActionsLeading={props.exportPdf}
            contextControls={props.contextControls}
            headerContextLabel={HEAD_DEPARTMENT_LABEL}
            loadingAudience="head"
          />
        </div>
      )}
    </div>
  );
}

export function HeadReportShell({
  reportId,
  mode,
  authorId,
}: HeadReportShellProps) {
  // Scope + archive filter in the URL so refresh/shared links restore them.
  const urlState = useReportShellUrlState({ stripParams: HEAD_STRIP_PARAMS });
  const deckRef = useRef<HTMLDivElement>(null);
  const fullscreenToggleRef = useRef<HTMLButtonElement>(null);
  const fullscreen = useFullscreen(
    deckRef,
    fullscreenToggleRef,
    mode === "slides",
  );
  const { periods, displayed, historyError, isLoading } = useHeadPeriodData(
    reportId,
    urlState.includeArchive,
  );

  const exportPdf = renderExportPdf(displayed);
  const contextControls = (
    <HeadContextControls
      periods={periods}
      reportId={reportId}
      mode={mode}
      urlState={urlState}
      historyError={historyError}
      historyLoading={isLoading}
      fullscreenControl={
        mode === "slides" ? (
          <DeckToolbarControls
            isFullscreen={fullscreen.isFullscreen}
            onToggle={fullscreen.toggle}
            toggleRef={fullscreenToggleRef}
          />
        ) : undefined
      }
    />
  );

  return (
    <HeadReportBody
      reportId={reportId}
      mode={mode}
      authorId={authorId}
      scope={urlState.scope}
      deckRef={deckRef}
      fullscreenToggleRef={fullscreenToggleRef}
      isFullscreen={fullscreen.isFullscreen}
      onToggleFullscreen={fullscreen.toggle}
      isLoading={isLoading}
      exportPdf={exportPdf}
      contextControls={contextControls}
    />
  );
}
