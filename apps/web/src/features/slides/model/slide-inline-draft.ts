import type { ReportSectionReadModel } from "@customreport/shared";

import type {
  DecisionEntry,
  KanbanItem,
  RiskEntry,
} from "../../report-sections/model/mock-data";
import type { GridRowEditableRef } from "./slide-grid-rows";

type SectionItem = ReportSectionReadModel["items"][number];

export function applySlideInlineItemEdit(
  section: ReportSectionReadModel,
  stableId: string,
  item: KanbanItem,
): ReportSectionReadModel {
  const workflowStatus = itemStatusToWorkflow(item.status);
  const parentFields = item.activityId
    ? { projectId: null, activityId: item.activityId, stageIds: [] as string[] }
    : {
        projectId: item.productId || null,
        activityId: null,
        stageIds: item.stageIds,
      };
  return {
    ...section,
    items: section.items.map((existing) =>
      existing.stableId === stableId
        ? {
            ...existing,
            ...parentFields,
            text: item.text,
            workflowStatus,
            stageName: null,
            priorityRank: item.priorityRank ?? null,
            pausedReason:
              workflowStatus === "paused" ? (item.pausedReason ?? null) : null,
          }
        : existing,
    ),
  };
}

export function applySlideInlineRiskEdit(
  section: ReportSectionReadModel,
  stableId: string,
  risk: RiskEntry,
): ReportSectionReadModel {
  const parentFields = risk.activityId
    ? { projectId: null, activityId: risk.activityId, stageIds: [] as string[] }
    : {
        projectId: risk.productId || null,
        activityId: null,
        stageIds: risk.stageIds,
      };
  return {
    ...section,
    risks: section.risks.map((existing) =>
      existing.stableId === stableId
        ? {
            ...existing,
            ...parentFields,
            risk: risk.text,
            impact: risk.impact,
            mitigation: risk.mitigation,
            severity: risk.severity,
            stageName: null,
          }
        : existing,
    ),
  };
}

export function applySlideInlineDecisionEdit(
  section: ReportSectionReadModel,
  stableId: string,
  decision: DecisionEntry,
): ReportSectionReadModel {
  const parentFields = decision.activityId
    ? {
        productId: null,
        activityId: decision.activityId,
        stageIds: [] as string[],
      }
    : {
        productId: decision.productId || null,
        activityId: null,
        stageIds: decision.stageIds,
      };
  return {
    ...section,
    decisions: section.decisions.map((existing) =>
      existing.stableId === stableId
        ? {
            ...existing,
            ...parentFields,
            text: decision.text,
            owner: decision.owner,
            impact: decision.impact,
            deadline: decision.deadline ? new Date(decision.deadline) : null,
            stageName: null,
          }
        : existing,
    ),
  };
}

export function deleteSlideInlineRecord(
  section: ReportSectionReadModel,
  ref: GridRowEditableRef,
): ReportSectionReadModel {
  switch (ref.kind) {
    case "item":
      return {
        ...section,
        items: section.items.filter((item) => item.stableId !== ref.stableId),
      };
    case "risk":
      return {
        ...section,
        risks: section.risks.filter((risk) => risk.stableId !== ref.stableId),
      };
    case "decision":
      return {
        ...section,
        decisions: section.decisions.filter(
          (decision) => decision.stableId !== ref.stableId,
        ),
      };
  }
}

function itemStatusToWorkflow(
  status: KanbanItem["status"],
): SectionItem["workflowStatus"] {
  switch (status) {
    case "completed":
      return "done";
    case "planned":
      return "planned";
    case "paused":
      return "paused";
    case "postponed":
      return "postponed";
    case "blocked":
    case "in-progress":
      return "in_progress";
  }
}
