import { AgentReviewComingSoon } from "../../../shared/ui/report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../../../shared/ui/report-shell/archive-toggle";
import { ScopeToggle } from "../../../shared/ui/report-shell/scope-toggle";
import type { ReportShellScopeValue } from "../../../shared/ui/report-shell/use-report-shell-url-state";
import { ViewModeToggle } from "../../../shared/ui/report-shell/view-mode-toggle";
import { PeriodNavigationSkeleton, PeriodNavigator } from "../../period";
import type { ReportPeriod } from "../../report-sections";

interface ViewerContextControlsProps {
  readonly periods: readonly ReportPeriod[];
  readonly reportId: string;
  readonly urlBuilder: (periodId: string) => string;
  readonly includeArchive: boolean;
  readonly setIncludeArchive: (value: boolean) => void;
  readonly scope: ReportShellScopeValue;
  readonly setScope: (value: ReportShellScopeValue) => void;
  readonly editHref: string;
  readonly slidesHref: string;
  readonly mode: "form" | "slides";
  readonly historyError: boolean;
  readonly historyLoading: boolean;
}

// Shared by both viewer render paths (page and slides).
export function ViewerContextControls({
  periods,
  reportId,
  urlBuilder,
  includeArchive,
  setIncludeArchive,
  scope,
  setScope,
  editHref,
  slidesHref,
  mode,
  historyError,
  historyLoading,
}: ViewerContextControlsProps) {
  return (
    <>
      {historyError ? (
        <span
          className="text-xs font-medium text-[var(--color-destructive)]"
          role="alert"
          data-testid="viewer-history-error"
        >
          Period history unavailable
        </span>
      ) : historyLoading ? (
        <PeriodNavigationSkeleton testId="viewer-period-navigation-skeleton" />
      ) : periods.length > 0 ? (
        <PeriodNavigator
          periods={periods}
          currentPeriodId={reportId}
          urlBuilder={urlBuilder}
        />
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
}
