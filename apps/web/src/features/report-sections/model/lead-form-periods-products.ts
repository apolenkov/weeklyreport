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
} from "../../../shared/lib/format/format-date";
import { deriveEffectiveStageStatus } from "../../../shared/lib/status/stage-status";
import { riskCoversStage } from "./stage-tags";
import { trafficToStageStatus } from "./traffic-light";
import type { Product, ReportPeriod, StageAssignment } from "./types";

type LeadStageAssignment = StageAssignment;
export type LeadProduct = Product;
export type LeadReportPeriod = ReportPeriod;

// Stage names use the shared canonical list so dialogs, storage, and pipeline
// rendering cannot drift. Short labels are display-only and are never stored.

// Restrict stage choices to canonical names owned by the lead; an omitted
// project unions assignments across all projects.
export function ownedStagesForProject(
  section: ReportSectionReadModel,
  projectId: string | undefined,
): string[] {
  const projects = projectId
    ? section.projects.filter((p) => p.projectId === projectId)
    : section.projects;
  const rawOwned = projects.flatMap((project) =>
    project.ownedStages.map((stage) => stage.stageName),
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

// Preserve raw empty for untouched stages; only covered stages derive a risk
// floor, keeping chip display and completeness semantics distinct.
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

// Derive grid membership from the admin-owned stageSet; owned rows are
// editable and other assigned rows stay locked instead of becoming vacant.
export function mapLeadProducts(
  section: ReportSectionReadModel,
): LeadProduct[] {
  return section.projects.map((p) => {
    const ownedStages = p.ownedStages;
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
        p.stageSet,
        coveringRisks,
      ),
    };
  });
}

// Sort by period date, mark the active report, and preserve server-provided
// counts without mapper fallbacks.
export function mapLeadPeriods(
  history: readonly MyHistoryEntry[],
  activeReportId: string | null,
): LeadReportPeriod[] {
  return [...history]
    .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())
    .map((e) => ({
      id: e.reportId,
      periodStart: e.periodStart,
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
