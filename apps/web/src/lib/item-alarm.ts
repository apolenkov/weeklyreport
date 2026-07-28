import {
  riskCoversStage,
  splitStageNames,
} from "../features/report-sections/model/stage-tags";

// Item-card alarm is the roll-up of covering risk/blocker rows — never a free
// per-item choice. Same one-source rule as stage chips (`lib/stage-status.ts`).
// See openspec/specs/record-status-derivation and status-risk-unification.
export type ItemAlarm = "at-risk" | "blocked" | null;

export interface AlarmItem {
  readonly productId: string;
  readonly stageNames?: readonly string[] | undefined;
  /** @deprecated legacy single-stage label; read only to heal old rows. */
  readonly stageName?: string | undefined;
  readonly status:
    | "in-progress"
    | "completed"
    | "planned"
    | "paused"
    | "postponed"
    | "blocked";
}

export interface AlarmRisk {
  readonly productId: string;
  readonly stageNames?: readonly string[] | undefined;
  readonly stageName?: string | undefined;
  readonly severity: "at-risk" | "blocked";
  // Empty (placeholder) risk text covers nothing.
  readonly text: string;
}

function itemStageNames(item: AlarmItem): readonly string[] {
  if (item.stageNames && item.stageNames.length > 0) return item.stageNames;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- intentional legacy-data read; replacement noted in the deprecation comment
  return splitStageNames(item.stageName);
}

// Coverage: same product + stage overlap (or empty risk stages = wildcard);
// stage-less items match any same-product risk so alarms are not under-reported.
// Only `in-progress` is floored — finished/not-in-flight work is not.
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

export function highestAlarmSeverity(risks: readonly AlarmRisk[]): ItemAlarm {
  if (risks.some((risk) => risk.severity === "blocked")) return "blocked";
  if (risks.some((risk) => risk.severity === "at-risk")) return "at-risk";
  return null;
}

export function deriveItemAlarmFromRisks(
  item: AlarmItem,
  risks: readonly AlarmRisk[],
): ItemAlarm {
  return highestAlarmSeverity(coveringRisksForItem(item, risks));
}
