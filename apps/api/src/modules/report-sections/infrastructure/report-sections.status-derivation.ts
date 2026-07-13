import type { TrafficLightStatus } from "@customreport/shared";

/** Worst-case severity rank for the per-project traffic-light aggregation (any red stage wins). */
const TRAFFIC_LIGHT_RED_SEVERITY = 3;

export function aggregateStageTraffic(
  stages: { status?: string | null }[],
): string | null {
  // eslint-disable-next-line no-restricted-syntax -- Loop-carried severity preserves the first red-stage short-circuit; a reduce would keep scanning after the terminal state.
  let severity = 0;
  for (const stage of stages) {
    if (stage.status === "red") {
      severity = TRAFFIC_LIGHT_RED_SEVERITY;
      break;
    }
    if (stage.status === "yellow") severity = Math.max(severity, 2);
    if (stage.status === "green") severity = Math.max(severity, 1);
  }
  return severity === TRAFFIC_LIGHT_RED_SEVERITY
    ? "red"
    : severity === 2
      ? "yellow"
      : severity === 1
        ? "green"
        : null;
}

type TrafficLight = TrafficLightStatus;

const TRAFFIC_SEVERITY: Record<TrafficLight, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

/**
 * fix-published-empty-stage-risk-floor (D5 option a): the API restatement of
 * the `riskCoversStage` covers-all rule. The web helper
 * (`apps/web/src/components/lead/stage-tags.ts`) lives behind the app boundary
 * and carries a `"use client"` React import, so it cannot be imported here.
 *
 * `stageIds` is a misnomer — it holds stage NAMES, not UUIDs. An empty/absent
 * array means "covers every stage the author owns on this product"; a populated
 * array covers only the named stages.
 */
function riskCoversStageName(
  risk: { stageIds?: readonly string[] },
  stageName: string,
): boolean {
  if (!risk.stageIds || risk.stageIds.length === 0) return true;
  return risk.stageIds.includes(stageName);
}

function severityToTraffic(severity: string | undefined): TrafficLight | null {
  if (severity === "blocked") return "red";
  if (severity === "at-risk") return "yellow";
  return null;
}

export function asTraffic(
  status: string | null | undefined,
): TrafficLight | null {
  return status === "green" || status === "yellow" || status === "red"
    ? status
    : null;
}

function worseTraffic(
  a: TrafficLight | null,
  b: TrafficLight | null,
): TrafficLight | null {
  if (a === null) return b;
  if (b === null) return a;
  return TRAFFIC_SEVERITY[a] >= TRAFFIC_SEVERITY[b] ? a : b;
}

/**
 * fix-published-empty-stage-risk-floor: derives the risk-aware effective
 * product status at the READ layer. For each owned stage, the effective status
 * is the worse of the raw stage status and the highest-severity own risk that
 * covers it. The product status is the worst across owned stages, floored
 * against the raw `trafficLight` so the floor never lowers (a real red
 * ProjectStatus survives a milder risk) and double-application stays
 * idempotent.
 *
 * CRITICAL: risks MUST be scoped to the product (`risk.projectId === projectId`)
 * BEFORE the per-stage match. `riskCoversStageName` matches stage NAME only and
 * the 7 SDLC stage names are shared across every product, so an unscoped fold
 * would floor the wrong product (and a covers-all risk every product). This
 * mirrors the `buildStageGrid` call site, which pre-filters by `projectId`.
 *
 * Per D4 this is aggregation-only: it never writes back to the raw persisted
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

  return (project.ownedStages ?? []).reduce<TrafficLight | null>(
    (effective, stage) => {
      const coveringSeverity = scopedRisks
        .filter((risk) => riskCoversStageName(risk, stage.stageName))
        .reduce<TrafficLight | null>(
          (acc, risk) => worseTraffic(acc, severityToTraffic(risk.severity)),
          null,
        );
      const stageEffective = worseTraffic(
        asTraffic(stage.status),
        coveringSeverity,
      );
      return worseTraffic(effective, stageEffective);
    },
    project.trafficLight,
  );
}

/**
 * activity-first-class (design decision 5): the activity pill's status floor.
 * An activity has no SDLC stage, so it is floored by its OWN risks only — a
 * `blocked` risk forces red, an `at-risk` risk forces at least yellow. Items
 * carry progress, never an alarm (rework-item-status-model), so they cannot
 * floor the pill. `alarmFloor` is that RECORD-ONLY floor (never the lead's
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
  const alarmFloor = ownRisks.reduce<TrafficLight | null>(
    (acc, risk) =>
      worseTraffic(
        acc,
        severityToTraffic(risk.severity === "blocked" ? "blocked" : "at-risk"),
      ),
    null,
  );
  return { derivedStatus: worseTraffic(stored, alarmFloor), alarmFloor };
}
