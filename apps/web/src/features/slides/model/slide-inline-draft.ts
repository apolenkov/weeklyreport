import type { ReportSectionReadModel } from "@customreport/shared";

import type {
  DecisionEntry,
  KanbanItem,
  RiskEntry,
} from "../../report-sections";
import { persistableItemStatusToWorkflow } from "../../report-sections";
import type { GridRowEditableRef } from "./slide-grid-rows";

/**
 * Apply Slide Inline Item Edit.
 * @param section - The section argument.
 * @param stableId - The stableId argument.
 * @param item - The item argument.
 */
export function applySlideInlineItemEdit(
  section: ReportSectionReadModel,
  stableId: string,
  item: KanbanItem,
): ReportSectionReadModel {
  const workflowStatus = persistableItemStatusToWorkflow(item.status);
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
            priorityRank: item.priorityRank ?? null,
            pausedReason:
              workflowStatus === "paused" ? (item.pausedReason ?? null) : null,
          }
        : existing,
    ),
  };
}

/**
 * Apply Slide Inline Risk Edit.
 * @param section - The section argument.
 * @param stableId - The stableId argument.
 * @param risk - The risk argument.
 */
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
          }
        : existing,
    ),
  };
}

/**
 * Apply Slide Inline Decision Edit.
 * @param section - The section argument.
 * @param stableId - The stableId argument.
 * @param decision - The decision argument.
 */
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
          }
        : existing,
    ),
  };
}

/**
 * Delete Slide Inline Record.
 * @param section - The section argument.
 * @param ref - The ref argument.
 */
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
