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

// Stage names use the shared canonical list so dialogs, storage, and pipeline
// rendering cannot drift. Short labels are display-only and are never stored.

/**
 * Stages-the-current-user-owns selector. Returns the list of stage names the
 * section author has a `StageAssignment` for on the given project. Used by
 * the lead-form modals to limit the "SDLC stage" dropdown to stages the
 * current lead actually owns. When `projectId` is undefined (decisions /
 * priorities are department-scoped), returns the union across all projects.
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

interface OwnedStageInput {
  stageName: string;
  status?: TrafficLightStatus | null | undefined;
}
interface StageRisk {
  stageNames?: readonly string[] | undefined;
  severity: RiskSeverity;
}

/**
 * Build the grid row for a stage this lead OWNS. Split out of `buildStageGrid`
 * so that function stays a thin filter+map over `STAGE_NAMES`.
 *
 * An untouched stage keeps raw `status: "empty"` (the chip distinction reads
 * it; completeness counts it via `coveredByOwnRisk` below, not via this
 * status). A touched stage derives floor-up / collapse-down from covering
 * risks. Empty or undefined stage IDs mean that a risk covers every owned
 * stage; routing through `riskCoversStage` keeps read and edit models aligned.
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
    // Completeness counts only risks that explicitly name the stage. A
    // covers-all or legacy stage-less risk must not make every stage complete.
    coveredByOwnRisk: risks.some(
      (r) =>
        Array.isArray(r.stageNames) &&
        r.stageNames.length > 0 &&
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
  // Membership is assignment-driven. Unioning the lead's own assignments
  // keeps them visible when a legacy fixture has an incomplete stageSet.
  const inStageSet = (stageName: string): boolean =>
    stageSet.some((s) => stageNamesMatch(s.stageName, stageName)) ||
    ownedStages.some((s) => stageNamesMatch(s.stageName, stageName));
  return STAGE_NAMES.filter(inStageSet).map((stageName) => {
    const ownedStage =
      ownedStages.find((s) => stageNamesMatch(s.stageName, stageName)) ?? null;
    if (ownedStage) {
      return deriveOwnedStageRow(stageName, ownedStage, ownerLabel, risks);
    }
    // A stage assigned to another lead is read-only. Everyone mode resolves
    // its assignee and status; Mine mode removes it with the visibility filter.
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
 * Each project's `stageSet` is the union of all lead assignments and therefore
 * defines grid membership. `ownedStages` selects editable rows; the rest are
 * locked. Unassigned stages are absent rather than rendered as vacant chips.
 *
 * The grid must come from `stageSet` rather than be synthesized here: a
 * synthesized one cannot reflect what the Products admin tab assigned, so
 * stages set there would never reach /lead/report.
 */
export function mapLeadProducts(
  section: ReportSectionReadModel,
): LeadProduct[] {
  return section.projects.map((p) => {
    const ownedStages = p.ownedStages ?? [];
    const overallStatus = trafficToStageStatus(p.trafficLight);
    // Touched stages apply the risk floor; untouched stages keep the raw empty
    // state so display severity and form completeness remain distinct.
    const coveringRisks = section.risks.filter(
      (r) => r.projectId === p.projectId && r.risk.trim().length > 0,
    );
    return {
      id: p.projectId,
      name: p.projectName,
      overallStatus,
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
