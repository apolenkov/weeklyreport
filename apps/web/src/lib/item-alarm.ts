import {
  riskCoversStage,
  splitStageNames,
} from "../features/report-sections/model/stage-tags";

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
  readonly status:
    | "in-progress"
    | "completed"
    | "planned"
    | "paused"
    | "postponed"
    | "blocked";
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
 * The risks that cover an item — the same coverage rule the alarm derivation
 * applies, exposed so a caller can also read WHICH risk floors the item (e.g.
 * to attribute a foreign author's covering risk).
 *
 * Coverage (design Decision 1): a risk covers the item when it shares the
 * product AND overlaps a stage — the item's stage set intersects the risk's, OR
 * the risk's stage set is the empty wildcard (`riskCoversStage` folds that in).
 * A stage-less item (a legacy anomaly, never disguised) is covered by ANY
 * same-product risk so its alarm is never silently under-reported. Empty
 * (placeholder) risks cover nothing.
 *
 * Eligibility: only an `in-progress` item is floored. A `completed`, `planned`,
 * `paused` or `postponed` item is finished / not-in-flight work — a covering
 * risk is about in-flight work on the stage, so flooring those would be wrong
 * (seed `mock-data.ts` cw2/cw4 are completed + stage-less on a risk-covered
 * product — the wildcard would otherwise floor them).
 *
 * The caller passes the covering risks to consider: its own risks for the
 * pill, or — for foreign attribution — the merged own+foreign same-product
 * risks so a co-owner's blocker can floor and name them. The generic preserves
 * the caller's richer row type (e.g. `RiskEntry` with author metadata) so each
 * covering row carries its author back to the caller.
 */
export function coveringRisksForItem<T extends AlarmRisk>(
  item: AlarmItem,
  risks: readonly T[],
): T[] {
  if (item.status !== "in-progress") return [];
  const stages = itemStageNames(item);
  return risks.filter((risk) => {
    if (risk.productId !== item.productId) return false;
    if (risk.text.trim().length === 0) return false;
    if (stages.length === 0) return true;
    return stages.some((stage) => riskCoversStage(risk, stage));
  });
}

/** The highest alarm among a set of covering risks (`blocked` > `at-risk`). */
export function highestAlarmSeverity(risks: readonly AlarmRisk[]): ItemAlarm {
  if (risks.some((risk) => risk.severity === "blocked")) return "blocked";
  if (risks.some((risk) => risk.severity === "at-risk")) return "at-risk";
  return null;
}

/**
 * Derive an item's at-risk/blocked alarm from the section's covering risks —
 * the highest covering severity wins (`blocked` > `at-risk`), or `null` when no
 * risk covers it. See {@link coveringRisksForItem} for the coverage +
 * eligibility rules.
 */
export function deriveItemAlarmFromRisks(
  item: AlarmItem,
  risks: readonly AlarmRisk[],
): ItemAlarm {
  return highestAlarmSeverity(coveringRisksForItem(item, risks));
}
