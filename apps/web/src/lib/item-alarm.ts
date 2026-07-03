import {
  riskCoversStage,
  splitStageNames,
} from "../components/lead/stage-tags";

/**
 * The at-risk/blocked alarm an item inherits from its covering risks, or `null`
 * when uncovered. This is the item-card analogue of the stage chip's
 * `deriveEffectiveStageStatus` floor (`lib/stage-status.ts`): the alarm is NEVER
 * a free per-item choice — it is the roll-up of the covering risk/blocker rows,
 * the single source of truth `status-risk-unification` already enforces for
 * stage chips (record-status-derived-from-risk).
 */
export type ItemAlarm = "at-risk" | "blocked" | null;

/** Minimal item shape the derivation reads (product parent + stage + status). */
export interface AlarmItem {
  readonly productId: string;
  readonly stageIds?: readonly string[];
  /** @deprecated legacy single-stage label; read only to heal old rows. */
  readonly stageName?: string;
  readonly status: "in-progress" | "completed" | "blocked" | "planned";
}

/** Minimal risk shape the derivation reads. */
export interface AlarmRisk {
  readonly productId: string;
  readonly stageIds?: readonly string[];
  readonly stageName?: string;
  readonly severity: "at-risk" | "blocked";
  /** The risk's own text — an empty (placeholder) risk covers nothing. */
  readonly text: string;
}

/** The item's stage names, healing a legacy single-stage label. */
function itemStageNames(item: AlarmItem): readonly string[] {
  if (item.stageIds && item.stageIds.length > 0) return item.stageIds;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
  return splitStageNames(item.stageName);
}

/**
 * Derive an item's at-risk/blocked alarm from the section's covering risks —
 * the highest covering severity wins (`blocked` > `at-risk`), or `null` when no
 * risk covers it.
 *
 * Coverage (design Decision 1): a risk covers the item when it shares the
 * product AND overlaps a stage — the item's stage set intersects the risk's, OR
 * the risk's stage set is the empty wildcard (`riskCoversStage` folds that in).
 * A stage-less item (a legacy anomaly, never disguised) is covered by ANY
 * same-product risk so its alarm is never silently under-reported. Empty
 * (placeholder) risks cover nothing.
 *
 * Eligibility: only an `in-progress` item is floored. A `completed` or
 * `planned` item is finished / not-yet-started work — a covering risk is about
 * in-flight work on the stage, so flooring those to an alarm would be wrong
 * (seed `mock-data.ts` cw2/cw4 are completed + stage-less on a risk-covered
 * product — the wildcard would otherwise floor them).
 *
 * The caller passes the SECTION's own risks; cross-section coverage never
 * applies (same `reportSectionId` is implicit in the risk list handed in).
 */
export function deriveItemAlarmFromRisks(
  item: AlarmItem,
  risks: readonly AlarmRisk[],
): ItemAlarm {
  if (item.status !== "in-progress") return null;
  const stages = itemStageNames(item);
  const covers = (risk: AlarmRisk): boolean => {
    if (risk.productId !== item.productId) return false;
    if (risk.text.trim().length === 0) return false;
    if (stages.length === 0) return true;
    return stages.some((stage) => riskCoversStage(risk, stage));
  };
  const covering = risks.filter(covers);
  if (covering.some((risk) => risk.severity === "blocked")) return "blocked";
  if (covering.some((risk) => risk.severity === "at-risk")) return "at-risk";
  return null;
}
