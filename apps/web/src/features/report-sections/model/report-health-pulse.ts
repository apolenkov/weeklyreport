import type { CanonicalStatus } from "@weeklyreport/shared";
import {
  riskSeverityToCanonicalFloor,
  trafficLightToCanonical,
  worstCanonicalStatus,
} from "@weeklyreport/shared";

import type {
  StatusOverviewSection,
  StatusOverviewUnit,
} from "./status-overview";

export interface ReportHealthUnit {
  readonly key: string;
  readonly name: string;
  readonly kind: "product" | "activity";
  readonly status: CanonicalStatus;
  readonly stages: readonly {
    readonly name: string;
    readonly status: CanonicalStatus;
  }[];
  readonly missingStages: readonly string[];
  readonly risks: readonly {
    readonly id: string;
    readonly description: string;
    readonly impact: string;
    readonly mitigation: string;
    readonly locations: readonly string[];
    readonly severity: CanonicalStatus;
  }[];
  readonly historical: boolean;
}

export interface ReportHealthPulse {
  readonly units: readonly ReportHealthUnit[];
  readonly blocked: number;
  readonly atRisk: number;
  readonly missing: number;
  readonly total: number;
}

type SectionRisk = StatusOverviewSection["risks"][number];

function riskId(risk: SectionRisk, index: number, unitKey: string): string {
  return risk.id ?? risk.stableId ?? `${unitKey}:risk:${index}`;
}

function projectRisks(
  unit: StatusOverviewUnit,
  section: StatusOverviewSection,
): ReportHealthUnit["risks"] {
  if (unit.historical) return [];

  const stageNames = new Set(unit.stages.map((stage) => stage.name));
  return section.risks.flatMap((risk, index) => {
    if (risk.risk.trim().length === 0) return [];

    const locations =
      unit.kind === "product"
        ? risk.stageNames.filter((stageName) => stageNames.has(stageName))
        : risk.stageNames;
    const belongsToUnit =
      unit.kind === "product"
        ? risk.projectId === unit.id && locations.length > 0
        : risk.activityId === unit.id;
    if (!belongsToUnit) return [];

    return [
      {
        id: riskId(risk, index, unit.key),
        description: risk.risk,
        impact: risk.impact,
        mitigation: risk.mitigation,
        locations,
        severity: riskSeverityToCanonicalFloor(risk.severity),
      },
    ];
  });
}

function activityStatus(
  unit: StatusOverviewUnit,
  section: StatusOverviewSection,
  risks: ReportHealthUnit["risks"],
): CanonicalStatus {
  if (unit.kind !== "activity" || unit.historical) return unit.status;
  const stored = section.activities.find(
    (activity) => activity.activityId === unit.id,
  )?.status;
  return worstCanonicalStatus([
    trafficLightToCanonical(stored),
    ...risks.map((risk) => risk.severity),
  ]);
}

function projectUnit(
  unit: StatusOverviewUnit,
  section: StatusOverviewSection,
): ReportHealthUnit {
  const risks = projectRisks(unit, section);
  return {
    key: unit.key,
    name: unit.name,
    kind: unit.kind,
    status: activityStatus(unit, section, risks),
    stages: unit.stages,
    missingStages: unit.stages
      .filter((stage) => stage.status === "empty")
      .map((stage) => stage.name),
    risks,
    historical: unit.historical,
  };
}

const PROBLEM_ORDER = ["blocked", "at-risk", "missing", "rest"] as const;

function isMissing(unit: ReportHealthUnit): boolean {
  return unit.status === "empty" || unit.missingStages.length > 0;
}

function problemCategory(
  unit: ReportHealthUnit,
): (typeof PROBLEM_ORDER)[number] {
  if (unit.status === "blocked") return "blocked";
  if (unit.status === "at-risk") return "at-risk";
  if (isMissing(unit)) return "missing";
  return "rest";
}

/** Projects the overview into a read-only, current-section health summary. */
export function projectReportHealthPulse(
  units: readonly StatusOverviewUnit[],
  section: StatusOverviewSection,
): ReportHealthPulse {
  const projected = units.map((unit) => projectUnit(unit, section));
  const current = projected.filter((unit) => !unit.historical);

  return {
    units: projected
      .map((unit, index) => ({ unit, index }))
      .sort(
        (left, right) =>
          PROBLEM_ORDER.indexOf(problemCategory(left.unit)) -
            PROBLEM_ORDER.indexOf(problemCategory(right.unit)) ||
          left.index - right.index,
      )
      .map(({ unit }) => unit),
    blocked: current.filter((unit) => unit.status === "blocked").length,
    atRisk: current.filter((unit) => unit.status === "at-risk").length,
    missing: current.filter(isMissing).length,
    total: current.length,
  };
}
