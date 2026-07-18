import { AgentReviewComingSoon } from "../../../shared/ui/report-shell/agent-review-coming-soon";
import { ArchiveToggle } from "../../../shared/ui/report-shell/archive-toggle";
import {
  ScopeToggle,
  type ScopeValue,
} from "../../../shared/ui/report-shell/scope-toggle";
import { ViewModeToggle } from "../../../shared/ui/report-shell/view-mode-toggle";
import { PeriodNavigator } from "../../period";
import type { ReportPeriod } from "../../report-sections";

interface ViewerContextControlsProps {
  readonly periods: ReportPeriod[];
  readonly reportId: string;
  readonly urlBuilder: (periodId: string) => string;
  readonly includeArchive: boolean;
  readonly setIncludeArchive: (value: boolean) => void;
  readonly scope: ScopeValue;
  readonly setScope: (value: ScopeValue) => void;
  readonly editHref: string;
  readonly slidesHref: string;
  readonly mode: "form" | "slides";
}

/** Toolbar controls shared by both viewer render paths (page and slides). */
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
}: ViewerContextControlsProps) {
  return (
    <>
      {periods.length > 0 ? (
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
