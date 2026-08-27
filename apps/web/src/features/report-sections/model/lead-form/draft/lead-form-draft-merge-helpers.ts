import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";

import { persistableItemStatusToWorkflow } from "../../item-status";
import type { DecisionEntry, KanbanItem, RiskEntry } from "../../types";
export { mergeProductDraft } from "./lead-form-draft-product-merge";

type DraftSection = ReportSectionReadModel;
type ResolvedKanbanItem = Exclude<
  KanbanItem,
  { readonly parent: { readonly kind: "unresolved" } }
>;

export function mergeActivityStatusDraft(
  section: DraftSection,
  activityId: string,
  status: TrafficLightStatus,
): DraftSection {
  return {
    ...section,
    activities: section.activities.map((activity) =>
      activity.activityId === activityId ? { ...activity, status } : activity,
    ),
  };
}

export function mergeDecisionDraft(
  section: DraftSection,
  next: readonly DecisionEntry[],
): DraftSection {
  const existingById = new Map(
    section.decisions.flatMap((decision) =>
      decision.id ? [[decision.id, decision] as const] : [],
    ),
  );
  const editableDecisions = next.filter((decision) => !decision.foreign);
  const decisions = editableDecisions.map((decision) => {
    const existing = existingById.get(decision.id);
    const deadline = decision.deadline ? new Date(decision.deadline) : null;
    const parentFields = decision.activityId
      ? {
          productId: null,
          activityId: decision.activityId,
          stageNames: [] as string[],
        }
      : {
          productId: decision.productId || null,
          activityId: null,
          stageNames: decision.stageNames,
        };
    if (existing) {
      return {
        ...existing,
        ...parentFields,
        text: decision.text,
        owner: decision.owner,
        impact: decision.impact,
        deadline,
        stageName: null,
      };
    }
    return {
      id: decision.id,
      ...parentFields,
      text: decision.text,
      owner: decision.owner,
      impact: decision.impact,
      deadline,
      resolvedAt: null,
      stageName: null,
    };
  });
  return { ...section, decisions };
}

export function mergeRiskDraft(
  section: DraftSection,
  next: readonly RiskEntry[],
): DraftSection {
  const editableRisks = next.filter((risk) => !risk.foreign);
  const existingById = new Map(
    section.risks.flatMap((risk) =>
      risk.id ? [[risk.id, risk] as const] : [],
    ),
  );
  const risks = editableRisks.map((risk) => {
    const existing = risk.id ? existingById.get(risk.id) : undefined;
    const parentFields = risk.activityId
      ? {
          projectId: null,
          activityId: risk.activityId,
          stageNames: [] as string[],
        }
      : {
          projectId: risk.productId,
          activityId: null,
          stageNames: risk.stageNames,
        };
    if (existing) {
      return {
        ...existing,
        ...parentFields,
        risk: risk.text,
        impact: risk.impact,
        mitigation: risk.mitigation,
        severity: risk.severity,
        stageName: null,
      };
    }
    return {
      id: risk.id,
      ...parentFields,
      risk: risk.text,
      impact: risk.impact,
      mitigation: risk.mitigation,
      severity: risk.severity,
      stageName: null,
    };
  });
  return { ...section, risks };
}

function mergeItemRow(
  item: ResolvedKanbanItem,
  itemType: "current" | "next",
  existing: DraftSection["items"][number] | undefined,
) {
  const workflowStatus = persistableItemStatusToWorkflow(item.status);
  const parentFields =
    item.parent.kind === "activity"
      ? {
          projectId: null,
          activityId: item.parent.id,
          stageNames: [] as string[],
        }
      : {
          projectId: item.parent.id,
          activityId: null,
          stageNames: item.stageNames,
        };
  const pausedReason =
    workflowStatus === "paused" ? (item.pausedReason ?? null) : null;
  if (existing) {
    return {
      ...existing,
      ...parentFields,
      text: item.text,
      workflowStatus,
      stageName: null,
      priorityRank: item.priorityRank ?? null,
      pausedReason,
    };
  }
  return {
    id: item.id,
    ...parentFields,
    type: itemType,
    text: item.text,
    tag: "general",
    workflowStatus,
    carriedOver: false,
    stageName: null,
    priorityRank: item.priorityRank ?? null,
    pausedReason,
  };
}

export function mergeItemsDraft(
  section: DraftSection,
  itemType: "current" | "next",
  next: readonly KanbanItem[],
): DraftSection {
  const editableItems = next.filter(
    (item): item is ResolvedKanbanItem =>
      !item.foreign && item.parent.kind !== "unresolved",
  );
  const existingById = new Map(
    section.items.flatMap((item) =>
      item.type === itemType && item.id ? [[item.id, item] as const] : [],
    ),
  );
  const mergedTyped = editableItems.map((item) =>
    mergeItemRow(item, itemType, existingById.get(item.id)),
  );
  const others = section.items.filter((item) => item.type !== itemType);
  return { ...section, items: [...others, ...mergedTyped] };
}

export function patchDraftItem(
  section: DraftSection,
  itemId: string,
  patch: Partial<DraftSection["items"][number]>,
): DraftSection {
  return {
    ...section,
    items: section.items.map((item) =>
      item.id === itemId ? { ...item, ...patch } : item,
    ),
  };
}
