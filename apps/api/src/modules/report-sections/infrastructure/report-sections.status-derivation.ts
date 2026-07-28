import {
  canonicalToTrafficLight,
  riskCoversStage,
  type RiskSeverity,
  riskSeverityToCanonicalFloor,
  type TrafficLightStatus,
} from "@customreport/shared";

import { aggregateTrafficLight } from "../domain/traffic-light-aggregation";

type TrafficLight = TrafficLightStatus;

export function aggregateStageTraffic(
  stages: readonly { status?: string | null | undefined }[],
): TrafficLight | null {
  return aggregateTrafficLight(stages.map((stage) => asTraffic(stage.status)));
}

export function asTraffic(
  status: string | null | undefined,
): TrafficLight | null {
  return status === "green" || status === "yellow" || status === "red"
    ? status
    : null;
}

// Risks MUST be product-scoped before the per-stage match: coverage matches
// stage names only and the 7 SDLC names repeat across products, so an unscoped
// fold floors the wrong product. Aggregation-only: never writes a status back.
export function deriveEffectiveProductStatus(project: {
  projectId: string;
  trafficLight: TrafficLight | null;
  ownedStages?:
    | readonly {
        stageName: string;
        status?: string | null | undefined;
      }[]
    | undefined;
  risks?:
    | readonly {
        // Nullable/optional: an activity-parented risk carries no product FK — it
        // never matches a product's projectId below, so it cannot floor product
        // health.
        projectId?: string | null | undefined;
        severity: RiskSeverity;
        stageNames?: readonly string[] | undefined;
      }[]
    | undefined;
}): TrafficLight | null {
  const scopedRisks = (project.risks ?? []).filter(
    (risk) => risk.projectId === project.projectId,
  );
  const stageStatuses = (project.ownedStages ?? []).map((stage) => {
    const coveringSeverity = aggregateTrafficLight(
      scopedRisks
        .filter((risk) => riskCoversStage(risk, stage.stageName))
        .map((risk) =>
          canonicalToTrafficLight(riskSeverityToCanonicalFloor(risk.severity)),
        ),
    );
    return aggregateTrafficLight([asTraffic(stage.status), coveringSeverity]);
  });

  return aggregateTrafficLight([project.trafficLight, ...stageStatuses]);
}

// An activity has no SDLC stage, so its pill is floored by its own risks only.
// `alarmFloor` is that record-only floor — the lead picker gates a manual lower
// on it alone, so a lead can still undo a raise they made themselves.
export function deriveActivityStatus(
  stored: TrafficLight | null,
  ownRisks: readonly { severity: RiskSeverity }[],
): { derivedStatus: TrafficLight | null; alarmFloor: TrafficLight | null } {
  const alarmFloor = aggregateTrafficLight(
    ownRisks.map((risk) =>
      canonicalToTrafficLight(riskSeverityToCanonicalFloor(risk.severity)),
    ),
  );
  return {
    derivedStatus: aggregateTrafficLight([stored, alarmFloor]),
    alarmFloor,
  };
}
