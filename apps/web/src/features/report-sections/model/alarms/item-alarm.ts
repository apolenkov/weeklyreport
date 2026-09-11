import {
  riskSeverityToCanonicalFloor,
  worstCanonicalStatus,
} from "@customreport/shared";

import { riskCoversStage } from "../stage-tags";

// Item-card alarm is the roll-up of covering risk/blocker rows — never a free
// per-item choice. See openspec/specs/record-status-derivation and
// status-risk-unification.
export type ItemAlarm = "at-risk" | "blocked" | null;

export interface AlarmItem {
  readonly productId: string;
  readonly stageNames: readonly string[];
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
  readonly stageNames: readonly string[];
  readonly severity: "at-risk" | "blocked";
  // Empty (placeholder) risk text covers nothing.
  readonly text: string;
}

// Coverage: same product + explicit stage overlap. Only `in-progress` is
// floored — finished/not-in-flight work is not.
export function coveringRisksForItem<T extends AlarmRisk>(
  item: AlarmItem,
  risks: readonly T[],
): T[] {
  if (item.status !== "in-progress") return [];
  const stages = item.stageNames;
  return risks.filter((risk) => {
    if (risk.productId !== item.productId) return false;
    if (risk.text.trim().length === 0) return false;
    if (stages.length === 0) return false;
    return stages.some((stage) => riskCoversStage(risk, stage));
  });
}

export function highestAlarmSeverity(risks: readonly AlarmRisk[]): ItemAlarm {
  if (risks.length === 0) return null;
  const worst = worstCanonicalStatus(
    risks.map((risk) => riskSeverityToCanonicalFloor(risk.severity)),
  );
  return worst === "blocked" ? "blocked" : "at-risk";
}

export function deriveItemAlarmFromRisks(
  item: AlarmItem,
  risks: readonly AlarmRisk[],
): ItemAlarm {
  return highestAlarmSeverity(coveringRisksForItem(item, risks));
}
