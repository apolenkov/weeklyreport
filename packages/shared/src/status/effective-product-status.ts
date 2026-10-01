import type {
  RiskSeverity,
  TrafficLightStatus,
} from "../schemas/primitives/report-primitives.schema.js";
import { riskCoversStage } from "../schemas/stages/stage-names.js";
import {
  canonicalToTrafficLight,
  riskSeverityToCanonicalFloor,
} from "../schemas/status/canonical-status.js";
import { aggregateTrafficLight } from "./traffic-light-aggregation.js";

const asTrafficLight = (
  status: string | null | undefined,
): TrafficLightStatus | null =>
  status === "green" || status === "yellow" || status === "red" ? status : null;

/**
 * Derives a product's effective traffic light from its stored status, owned
 * stage statuses, and product-parented risks that cover those stages.
 */
export function deriveEffectiveProductStatus(project: {
  readonly projectId: string;
  readonly trafficLight: TrafficLightStatus | null;
  readonly ownedStages?:
    | readonly {
        readonly stageName: string;
        readonly status?: string | null | undefined;
      }[]
    | undefined;
  readonly risks?:
    | readonly {
        readonly projectId?: string | null | undefined;
        readonly severity: RiskSeverity;
        readonly stageNames?: readonly string[] | undefined;
      }[]
    | undefined;
}): TrafficLightStatus | null {
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
    return aggregateTrafficLight([
      asTrafficLight(stage.status),
      coveringSeverity,
    ]);
  });

  return aggregateTrafficLight([project.trafficLight, ...stageStatuses]);
}
