import type {
  MyHistoryEntry,
  ReportSectionReadModel,
  RiskSeverity,
  TrafficLightStatus,
} from "@customreport/shared";
import {
  shortNameFromName,
  STAGE_NAMES,
  stageNamesMatch,
} from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  isoWeekNumber,
} from "../../../lib/format-date";
import { deriveEffectiveStageStatus } from "../../../lib/stage-status";
import { riskCoversStage } from "./stage-tags";
import { trafficToStageStatus } from "./traffic-light";
import type { Product, ReportPeriod, StageAssignment } from "./types";

type LeadStageAssignment = StageAssignment;
export type LeadProduct = Product;
export type LeadReportPeriod = ReportPeriod;

// stage-label-canonicalization: SDLC stage names come from the shared canonical
// `STAGE_NAMES` (imported above) — no local literal list. Dialogs source their
// stage options from it, so a record stores the full "Development"; the pipeline
// chip renders a display-only short label (`stageShortLabel`), never stored.

/**
 * Stages-the-current-user-owns selector. Returns the list of stage names the
 * section author has a `StageAssignment` for on the given project. Used by
 * the lead-form modals to limit the "SDLC stage" dropdown to stages the
 * current lead actually owns. When `projectId` is undefined (decisions /
 * priorities are department-scoped), returns the union across all projects.
 * @param section - The section argument.
 * @param projectId - The projectId argument.
 */
export function ownedStagesForProject(
  section: ReportSectionReadModel,
  projectId: string | undefined,
): string[] {
  const projects = projectId
    ? section.projects.filter((p) => p.projectId === projectId)
    : section.projects;
  const rawOwned = projects.flatMap(
    (project) => project.ownedStages?.map((stage) => stage.stageName) ?? [],
  );
  return STAGE_NAMES.filter((canonical) =>
    rawOwned.some((raw) => stageNamesMatch(canonical, raw)),
  );
}

/**
 * Build the stage grid for one project from the product's assigned-stage set.
 *
 * unassigned-stage-reporting-exclusion: the grid is sourced from `stageSet`
 * (the union of all leads' assignments on the product), NOT all seven canonical
 * stages. A stage owned by this lead (name in `ownedStages`) is `mine`; a stage
 * in the set but not owned is foreign-owned (`locked`, read-only); a stage with
 * NO assignment is absent from the set and excluded entirely. `ownedStages` is
 * unioned into the membership test defensively so the lead's own stages always
 * render even if `stageSet` is missing (legacy fixtures / frozen snapshots).
 * Order follows the canonical `STAGE_NAMES` pipeline order.
 *
 * rethink-pipeline-state-vs-completeness: an EMPTY owned stage — one the
 * lead never set a status on — keeps its raw `status: "empty"` even when a
 * covering risk exists. The risk-derived severity floor for DISPLAY is
 * re-applied at render by the live form's `applyRiskSeverityFloor` (and the
 * slide export's `floorSlideStageStatus`), so the chip still shows the risk
 * severity. The raw `status` must NOT be floored for an untouched stage:
 * flooring would erase the chip's risk-covered-vs-status-set distinction
 * and would count foreign/covers-all-covered stages toward
 * own-input completeness.
 *
 * fix-report-surface-integrity: own-input completeness no longer reads the
 * raw `status` alone — it counts a stage when `status !== "empty"` OR the lead's
 * OWN risk EXPLICITLY names it (`coveredByOwnRisk`, set below). So an empty stage
 * the lead deliberately staged a risk on DOES count, while its raw `status`
 * stays `empty` for the chip distinction. A covers-all (`stageIds: []`) or legacy
 * stage-less risk is excluded, so it never inflates the counter (the old "all
 * stages checked" Add-Risk footgun).
 *
 * A stage the lead DID touch (explicit on-track/at-risk/blocked) still flows
 * through `deriveEffectiveStageStatus`: it floors up to a worse covering risk
 * and collapses a stale, unbacked at-risk/blocked down to on-track. Either way
 * it stays non-empty, so completeness rightly counts it as filled.
 */
interface OwnedStageInput {
  stageName: string;
  status?: TrafficLightStatus | null;
}
interface StageRisk {
  stageIds?: readonly string[];
  severity: RiskSeverity;
}

/**
 * Build the grid row for a stage this lead OWNS. Split out of `buildStageGrid`
 * so that function stays a thin filter+map over `STAGE_NAMES`.
 *
 * An untouched stage keeps raw `status: "empty"` (the chip distinction reads
 * it; completeness counts it via `coveredByOwnRisk` below, not via this
 * status). A touched stage derives floor-up / collapse-down from covering
 * risks (unify-risk-stage-status: empty/undefined stageIds means the risk
 * covers every owned stage — routed through `riskCoversStage` so the read
 * model agrees with the live form on legacy stage-less risks).
 */
function deriveOwnedStageRow(
  stageName: string,
  ownedStage: OwnedStageInput,
  ownerLabel: string,
  risks: readonly StageRisk[],
): LeadStageAssignment {
  const explicit = trafficToStageStatus(ownedStage.status ?? null);
  return {
    stageName,
    status:
      explicit === "empty"
        ? "empty"
        : deriveEffectiveStageStatus(
            explicit,
            risks.filter((r) => riskCoversStage(r, stageName)),
            [],
          ),
    ownership: "mine" as const,
    // Stage owner labels render the short form ("Иванов В.П."); the full ФИО
    // is reserved for the top user badge. Avatar chips keep 2-letter initials.
    assignee: shortNameFromName(ownerLabel),
    // fix-report-surface-integrity: flag a stage the lead's OWN risk
    // EXPLICITLY names (strict — non-empty stageIds). A covers-all (`[]`) or
    // legacy stage-less risk is excluded, so it never inflates the counter.
    // The raw `status` above is left untouched — the chip distinguishes a
    // risk-covered empty stage from an explicitly-set one.
    coveredByOwnRisk: risks.some(
      (r) =>
        Array.isArray(r.stageIds) &&
        r.stageIds.length > 0 &&
        riskCoversStage(r, stageName),
    ),
  };
}

function buildStageGrid(
  ownerLabel: string,
  ownedStages: readonly OwnedStageInput[],
  stageSet: readonly { stageName: string }[] = [],
  risks: readonly StageRisk[] = [],
): LeadStageAssignment[] {
  // unassigned-stage-reporting-exclusion: membership is assignment-driven —
  // a stage renders only if it is in the product's `stageSet` (assigned to some
  // lead) or owned by this lead. Owned is unioned in defensively so the lead's
  // own stages survive a missing/partial `stageSet`.
  const inStageSet = (stageName: string): boolean =>
    stageSet.some((s) => stageNamesMatch(s.stageName, stageName)) ||
    ownedStages.some((s) => stageNamesMatch(s.stageName, stageName));
  return STAGE_NAMES.filter(inStageSet).map((stageName) => {
    const ownedStage =
      ownedStages.find((s) => stageNamesMatch(s.stageName, stageName)) ?? null;
    if (ownedStage) {
      return deriveOwnedStageRow(stageName, ownedStage, ownerLabel, risks);
    }
    // unassigned-stage-reporting-exclusion: in the product's stage set but not
    // owned by this lead — foreign-owned, rendered read-only (`locked`). In
    // Everyone mode `applyCrossAuthorStageOverrides` fills the real assignee +
    // status; in Mine mode it is hidden by the visibility filter.
    return {
      stageName,
      status: "empty" as const,
      ownership: "locked" as const,
      assignee: null,
    };
  });
}

/**
 * Map a section's projects -> presentation Product[].
 *
 * unassigned-stage-reporting-exclusion: each project's `stageSet` (the
 * union of all leads' `StageAssignment` rows on the product) sources the grid;
 * `ownedStages` (scoped to the section author) marks which of those render as
 * "mine" vs foreign-owned "locked". A stage with no assignment is absent from
 * the set and excluded — no vacant chip.
 *
 * Previously this mapper synthesized a fake grid that hard-coded the lead
 * onto "Dev", so assigning a lead to all 7 stages on the Products admin tab
 * did not show up on /lead/report.
 * @param section - The section argument.
 */
export function mapLeadProducts(
  section: ReportSectionReadModel,
): LeadProduct[] {
  return section.projects.map((p) => {
    const ownedStages = p.ownedStages ?? [];
    const overallStatus = trafficToStageStatus(p.trafficLight);
    // rethink-pipeline-state-vs-completeness: pass the covering risks so a
    // TOUCHED stage floors up / collapses down correctly, while an UNTOUCHED
    // (empty) stage keeps raw `status: "empty"` (see buildStageGrid).
    // buildStageGrid also tags it `coveredByOwnRisk` when an own risk names it,
    // which is how an empty-but-risk-staged stage counts toward completeness.
    const coveringRisks = section.risks.filter(
      (r) => r.projectId === p.projectId && r.risk.trim().length > 0,
    );
    return {
      id: p.projectId,
      name: p.projectName,
      overallStatus,
      // unassigned-stage-reporting-exclusion: the product's assigned-stage set
      // sources the grid; a stage with no assignment is excluded entirely.
      stages: buildStageGrid(
        section.authorName,
        ownedStages,
        p.stageSet ?? [],
        coveringRisks,
      ),
    };
  });
}

/**
 * Map `reports.myHistory` to the Period dropdown shape the LeadForm expects.
 * Sorts by `periodStart` descending so the dropdown reads newest→oldest
 * regardless of `section.createdAt` ordering (seed inserts can shuffle
 * createdAt; period date is the user-visible truth).
 *
 * The active reportId (if any) flags `isCurrent: true`; count fields are
 * passed through from `MyHistoryEntry` without mapper-level fallback zeros.
 * @param history - The history argument.
 * @param activeReportId - The activeReportId argument.
 */
export function mapLeadPeriods(
  history: readonly MyHistoryEntry[],
  activeReportId: string | null,
): LeadReportPeriod[] {
  return [...history]
    .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())
    .map((e) => ({
      id: e.reportId,
      sourceSectionId: e.sectionId,
      weekLabel: `Week ${isoWeekNumber(e.periodStart)}`,
      dateRange: formatPeriodRangeWithYear(e.periodStart, e.periodEnd),
      isCurrent: activeReportId !== null && e.reportId === activeReportId,
      isSubmitted: e.sectionStatus === "submitted",
      archived: e.archived ?? false,
      itemCount: e.itemCount,
      riskCount: e.riskCount,
      productCount: e.productCount,
    }));
}
