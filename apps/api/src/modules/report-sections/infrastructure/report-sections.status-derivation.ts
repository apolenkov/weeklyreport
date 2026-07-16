import {
  canonicalToTrafficLight,
  riskCoversStage,
  riskSeverityToCanonicalFloor,
  type TrafficLightStatus,
} from "@customreport/shared";

import { aggregateTrafficLight } from "../domain/traffic-light-aggregation";

type TrafficLight = TrafficLightStatus;

export function aggregateStageTraffic(
  stages: readonly { status?: string | null }[],
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

/**
 * Derives the risk-aware effective product status at the read layer. For each
 * owned stage, the effective status is the worse of the raw stage status and
 * the highest-severity own risk that
 * covers it. The product status is the worst across owned stages, floored
 * against the raw `trafficLight` so the floor never lowers (a real red
 * ProjectStatus survives a milder risk) and double-application stays
 * idempotent.
 *
 * CRITICAL: risks MUST be scoped to the product (`risk.projectId === projectId`)
 * BEFORE the per-stage match. Risk coverage matches stage names only and
 * the 7 SDLC stage names are shared across every product, so an unscoped fold
 * would floor the wrong product (and a covers-all risk every product). This
 * mirrors the `buildStageGrid` call site, which pre-filters by `projectId`.
 *
 * This is aggregation-only: it never writes back to the raw persisted
 * `StageStatus.status` nor to the read-model per-stage `status` field. A product
 * with no owned stages contributes nothing to floor (covers-all means "all
 * stages the author owns on THIS product"), so the raw `trafficLight` passes
 * through unchanged.
 */
export function deriveEffectiveProductStatus(project: {
  projectId: string;
  trafficLight: TrafficLight | null;
  ownedStages?: readonly {
    stageName: string;
    status?: string | null;
  }[];
  risks?: readonly {
    // Nullable/optional: an activity-parented risk carries no product FK — it
    // never matches a product's projectId below, so it cannot floor product
    // health. `undefined` tolerated for read-model risks (optional field).
    projectId?: string | null;
    severity?: string;
    stageIds?: readonly string[];
  }[];
}): TrafficLight | null {
  const scopedRisks = (project.risks ?? []).filter(
    (risk) => risk.projectId === project.projectId,
  );
  const stageStatuses = (project.ownedStages ?? []).map((stage) => {
    const coveringSeverity = aggregateTrafficLight(
      scopedRisks
        .filter((risk) => riskCoversStage(risk, stage.stageName))
        // Only a risk with an explicit severity floors the stage — an
        // unset severity on an otherwise-covering risk contributes nothing.
        .filter(
          (risk) => risk.severity === "blocked" || risk.severity === "at-risk",
        )
        .map((risk) =>
          canonicalToTrafficLight(riskSeverityToCanonicalFloor(risk.severity)),
        ),
    );
    return aggregateTrafficLight([asTraffic(stage.status), coveringSeverity]);
  });

  return aggregateTrafficLight([project.trafficLight, ...stageStatuses]);
}

/**
 * An activity has no SDLC stage, so its pill is floored by its own risks only: a
 * `blocked` risk forces red, an `at-risk` risk forces at least yellow. Items
 * carry progress, never an alarm, so they cannot floor the pill. `alarmFloor`
 * is that record-only floor (never the lead's
 * stored choice); `derivedStatus` folds the stored status in for the read-only
 * render surfaces (slides, head report). The stored `ActivityStatus.status` is
 * NEVER rewritten. The interactive lead picker gates a manual lower on
 * `alarmFloor` alone, so a lead can still lower a status they raised themselves
 * when no covering risk/blocker holds it up.
 */
export function deriveActivityStatus(
  stored: TrafficLight | null,
  ownRisks: readonly { severity: string }[],
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
