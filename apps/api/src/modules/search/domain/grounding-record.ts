import type { CanonicalStatus } from "@weeklyreport/shared";

import type { SearchCandidate } from "./report-retrieval.types.js";

type GroundingStages = Readonly<{ stages: readonly string[] }>;

export type GroundingRecord =
  | (GroundingStages &
      Readonly<{
        kind: "item";
        text: string;
        itemType: "current" | "next";
        workflowStatus:
          "planned" | "in_progress" | "paused" | "postponed" | "done";
        carriedOver: boolean;
        priorityRank: number | null;
      }>)
  | (GroundingStages &
      Readonly<{
        kind: "risk";
        risk: string;
        impact: string;
        mitigation: string;
        severity: "at-risk" | "blocked";
      }>)
  | (GroundingStages &
      Readonly<{
        kind: "decision";
        text: string;
        impact: string;
        owner: string;
        deadline: string | null;
        resolvedAt: string | null;
      }>)
  | (GroundingStages &
      Readonly<{
        kind: "product_status" | "stage_status";
        status: CanonicalStatus;
      }>)
  | (GroundingStages &
      Readonly<{
        kind: "activity_status";
        status: CanonicalStatus;
        note: string | null;
      }>);

const dateValue = (value: Date | null): string | null =>
  value?.toISOString() ?? null;

export const groundingRecord = (
  candidate: SearchCandidate,
): GroundingRecord => {
  const stages = candidate.context.stageIds;
  if (candidate.kind === "item") {
    return {
      kind: candidate.kind,
      text: candidate.text,
      itemType: candidate.itemType,
      workflowStatus: candidate.workflowStatus,
      carriedOver: candidate.carriedOver,
      priorityRank: candidate.priorityRank,
      stages,
    };
  }
  if (candidate.kind === "risk") {
    return {
      kind: candidate.kind,
      risk: candidate.risk,
      impact: candidate.impact,
      mitigation: candidate.mitigation,
      severity: candidate.severity,
      stages,
    };
  }
  if (candidate.kind === "decision") {
    return {
      kind: candidate.kind,
      text: candidate.text,
      impact: candidate.impact,
      owner: candidate.owner,
      deadline: dateValue(candidate.deadline),
      resolvedAt: dateValue(candidate.resolvedAt),
      stages,
    };
  }
  if (candidate.kind === "activity_status") {
    return {
      kind: candidate.kind,
      status: candidate.status,
      note: candidate.note,
      stages,
    };
  }
  return { kind: candidate.kind, status: candidate.status, stages };
};
