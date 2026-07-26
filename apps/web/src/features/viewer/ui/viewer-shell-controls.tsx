"use client";

import { useCallback } from "react";

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
}: {
  readonly reportId: string;
  readonly mode: "form" | "slides";
  readonly periods: ReportPeriod[];
  readonly urlState: ReportShellUrlState;
}) {
  const { buildQuery, includeArchive, setIncludeArchive, scope, setScope } =
    urlState;

  const urlBuilder = useCallback(
    (periodId: string) =>
      `/reports/${encodeURIComponent(periodId)}${buildQuery({})}`,
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
      editHref={`/reports/${encodeURIComponent(reportId)}${buildQuery({ mode: null })}`}
      slidesHref={`/reports/${encodeURIComponent(reportId)}${buildQuery({ mode: "slides" })}`}
      mode={mode}
    />
  );
}
