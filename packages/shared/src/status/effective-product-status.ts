import {
  type RiskSeverity,
  type TrafficLightStatus,
  trafficLightStatusSchema,
} from "../schemas/primitives/report-primitives.schema.js";
import { riskCoversStage } from "../schemas/stages/stage-names.js";
import {
  canonicalToTrafficLight,
  riskSeverityToCanonicalFloor,
} from "../schemas/status/canonical-status.js";
import { aggregateTrafficLight } from "./traffic-light-aggregation.js";

/** Returns an admitted traffic light or null without coercing unknown values. */
export function asTrafficLight(
  status: string | null | undefined,
): TrafficLightStatus | null {
  // The canonical schema owns the admitted vocabulary; anything else,
  // null/undefined included, reads as "not rated".
  const parsed = trafficLightStatusSchema.safeParse(status);
  return parsed.success ? parsed.data : null;
}

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
