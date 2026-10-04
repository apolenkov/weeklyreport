"use client";

import { Skeleton } from "@customreport/ui/components/ui/skeleton";
import { type ReactNode, useCallback, useContext } from "react";

import { SessionContext } from "../../../../shared/lib/auth/session-provider";
import { ArchiveToggle } from "../../../../shared/ui/report-shell/archive-toggle";
import {
  DocumentActionGroup,
  ReportToolbarCenterLabel,
} from "../../../../shared/ui/report-shell/report-toolbar";
import { ScopeToggle } from "../../../../shared/ui/report-shell/scope-toggle";
import type { ReportShellUrlState } from "../../../../shared/ui/report-shell/use-report-shell-url-state";
import { ViewModeToggle } from "../../../../shared/ui/report-shell/view-mode-toggle";
import {
  HeadPublishLockAction,
  PeriodNavigationSkeleton,
  PeriodNavigator,
} from "../../../period";
import type { ReportPeriod } from "../../../report-sections";

const FALLBACK_DEPARTMENT_LABEL = "CustomReport";

export type HeadReportMode = "form" | "slides";

function HeadDepartmentLabel() {
  const sessionState = useContext(SessionContext);
  return (
    <ReportToolbarCenterLabel
      label={sessionState?.organization?.fullName ?? FALLBACK_DEPARTMENT_LABEL}
      detail="Live portfolio review"
    />
  );
}

export const HEAD_DEPARTMENT_LABEL = <HeadDepartmentLabel />;

function HeadContextTrailing({
  urlState,
  reportId,
  mode,
  fullscreenControl,
}: {
  readonly urlState: ReportShellUrlState;
  readonly reportId: string;
  readonly mode: HeadReportMode;
  readonly fullscreenControl?: ReactNode;
}) {
  const { buildQuery, scope, setScope } = urlState;
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1.5"
      data-testid="head-context-trailing"
    >
      <ScopeToggle
        value={scope}
        onChange={setScope}
        allowedScopes={["product", "lead"]}
        ariaLabel="Record scope"
      />
      {fullscreenControl}
      <ViewModeToggle
        editHref={`/head/report/${encodeURIComponent(reportId)}${buildQuery({ mode: null })}`}
        slidesHref={`/head/report/${encodeURIComponent(reportId)}${buildQuery({ mode: "slides" })}`}
        mode={mode === "slides" ? "slides" : "edit"}
        desktopLabels
      />
    </div>
  );
}

export function HeadContextControls({
  periods,
  reportId,
  mode,
  urlState,
  historyError,
  historyLoading,
  fullscreenControl,
}: {
  readonly periods: readonly ReportPeriod[];
  readonly reportId: string;
  readonly mode: HeadReportMode;
  readonly urlState: ReportShellUrlState;
  readonly historyError: boolean;
  readonly historyLoading: boolean;
  readonly fullscreenControl?: ReactNode;
}) {
  const { buildQuery, includeArchive, setIncludeArchive } = urlState;
  const urlBuilder = useCallback(
    (periodId: string) =>
      `/head/report/${encodeURIComponent(periodId)}${buildQuery({})}`,
    [buildQuery],
  );

  return (
    <>
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 max-md:contents">
        {historyError ? (
          <span
            className="text-xs font-medium text-[var(--color-destructive)]"
            role="alert"
            data-testid="head-history-error"
          >
            Period history unavailable
          </span>
        ) : historyLoading ? (
          <PeriodNavigationSkeleton testId="head-period-navigation-skeleton" />
        ) : periods.length > 0 ? (
          <PeriodNavigator periods={periods} urlBuilder={urlBuilder} />
        ) : null}
        <span className="shrink-0">
          <ArchiveToggle
            checked={includeArchive}
            onChange={setIncludeArchive}
          />
        </span>
      </div>
      <div className="grow" aria-hidden="true" />
      <HeadContextTrailing
        urlState={urlState}
        reportId={reportId}
        mode={mode}
        fullscreenControl={fullscreenControl}
      />
    </>
  );
}

export function SlidesModeHeader({
  reportId,
  headerContextLabel,
  exportPdf,
  isLoading,
}: {
  readonly reportId: string;
  readonly headerContextLabel: React.ReactNode;
  readonly exportPdf: React.ReactNode;
  readonly isLoading: boolean;
}) {
  return (
    <header
      data-layout-key="weekly-report-header"
      data-layout-stability="position-size"
      className="flex min-h-36 flex-wrap items-center justify-between gap-4 sm:min-h-0 lg:grid lg:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h1 className="font-[family-name:var(--font-sans)] text-2xl font-semibold tracking-tight text-[var(--color-primary)]">
          Status Report
        </h1>
        {headerContextLabel}
      </div>
      <DocumentActionGroup>
        {isLoading ? (
          <>
            <Skeleton className="h-[var(--toolbar-control-h)] w-[var(--toolbar-control-h)] rounded-[var(--radius-pill)]" />
            <Skeleton className="h-[var(--toolbar-control-h)] w-36 rounded-[var(--radius-pill)]" />
          </>
        ) : (
          <>
            {exportPdf}
            <HeadPublishLockAction reportId={reportId} />
          </>
        )}
      </DocumentActionGroup>
    </header>
  );
}
