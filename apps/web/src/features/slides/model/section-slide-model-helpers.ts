import type { TrafficLightStatus } from "@customreport/shared";

import type {
  SlideReadinessItem,
  SlideStageStatus,
  SlideTone,
} from "./section-slide-contracts";

const PERCENT_MAX = 100;
const TRAFFIC_RANK: Record<TrafficLightStatus, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

export const NEEDS_WORK_STATUS = "needs-work";
export const CROSS_PRODUCT_ID = "cross-product";

export function nonEmpty(text: string | null | undefined): boolean {
  return typeof text === "string" && text.trim().length > 0;
}

export function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(nonEmpty))];
}

export function describeCount(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function readinessScore(items: readonly SlideReadinessItem[]): number {
  const required = items.filter((item) => item.required);
  if (required.length === 0) return PERCENT_MAX;
  const ready = required.filter((item) => item.status === "ready").length;
  return Math.round((ready / required.length) * PERCENT_MAX);
}

export function statusTone(model: {
  readonly currentCount: number;
  readonly nextCount: number;
  readonly riskCount: number;
  readonly priorityCount: number;
  readonly blockedCount: number;
  readonly atRiskCount: number;
}): SlideTone {
  if (model.currentCount === 0 && model.nextCount === 0) return "empty";
  if (model.blockedCount > 0) return "blocked";
  if (
    model.atRiskCount > 0 ||
    model.riskCount > 0 ||
    model.priorityCount === 0
  ) {
    return "warning";
  }
  return "ready";
}

export function worstTraffic(
  left: SlideStageStatus,
  right: SlideStageStatus,
): SlideStageStatus {
  if (left == null) return right;
  if (right == null) return left;
  return TRAFFIC_RANK[left] >= TRAFFIC_RANK[right] ? left : right;
}
