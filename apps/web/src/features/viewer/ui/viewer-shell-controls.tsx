"use client";

import { useCallback } from "react";

import { REPORTS_ROUTE } from "../../../shared/ui/navigation/nav-links";
import type { useReportShellUrlState } from "../../../shared/ui/report-shell/use-report-shell-url-state";
import type { ReportPeriod } from "../../report-sections";
import { ViewerContextControls } from "./viewer-context-controls";

type ReportShellUrlState = ReturnType<typeof useReportShellUrlState>;

// Owns the href derivation for the viewer chrome so the shell only forwards the
// URL state it already holds. Rendered by both viewer render paths.
export function ViewerShellControls({
  reportId,
  mode,
  periods,
  urlState,
  historyError,
  historyLoading,
  historyTruncated,
}: {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly periods: readonly ReportPeriod[];
  readonly urlState: ReportShellUrlState;
  readonly historyError: boolean;
  readonly historyLoading: boolean;
  readonly historyTruncated: boolean;
}) {
  const { buildQuery, includeArchive, setIncludeArchive, scope, setScope } =
    urlState;

  const urlBuilder = useCallback(
    (periodId: string) =>
      `${REPORTS_ROUTE}/${encodeURIComponent(periodId)}${buildQuery({})}`,
    [buildQuery],
  );

  return (
    <ViewerContextControls
      periods={periods}
      reportId={reportId}
      urlBuilder={urlBuilder}
      includeArchive={includeArchive}
      setIncludeArchive={setIncludeArchive}
      scope={scope}
      setScope={setScope}
      editHref={`${REPORTS_ROUTE}/${encodeURIComponent(reportId)}${buildQuery({ mode: null })}`}
      slidesHref={`${REPORTS_ROUTE}/${encodeURIComponent(reportId)}${buildQuery({ mode: "slides" })}`}
      mode={mode}
      historyError={historyError}
      historyLoading={historyLoading}
      historyTruncated={historyTruncated}
    />
  );
}
