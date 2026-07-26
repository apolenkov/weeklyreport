import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";

import {
  type DecisionEntry,
  type KanbanItem,
  normalizeStageName,
  persistableItemStatusToWorkflow,
  type Product,
  type RiskEntry,
  stageStatusToTraffic,
} from "../../report-sections";

type DraftSection = ReportSectionReadModel;
type StageStatusValue = TrafficLightStatus | null;

function aggregateTrafficLight(
  stages: readonly { status?: StageStatusValue }[],
): StageStatusValue {
  if (stages.some((stage) => stage.status === "red")) return "red";
  if (stages.some((stage) => stage.status === "yellow")) return "yellow";
  if (stages.some((stage) => stage.status === "green")) return "green";
  return null;
}

/**
 * Merge Product Draft.
 * @param section - The section argument.
 * @param next - The next argument.
 */
export function mergeProductDraft(
  section: DraftSection,
  next: readonly Product[],
): DraftSection {
  const nextStageStatusByKey = new Map<string, StageStatusValue>(
    next.flatMap((product) =>
      product.stages.flatMap((stage) =>
        stage.ownership === "mine"
          ? [
              [
                `${product.id}::${normalizeStageName(stage.stageName)}`,
                stageStatusToTraffic(stage.status),
              ] as const,
            ]
          : [],
      ),
    ),
  );

  const projects = section.projects.map((project) => {
    const ownedStages = (project.ownedStages ?? []).map((stage) => {
      const key = `${project.projectId}::${normalizeStageName(stage.stageName)}`;
      if (!nextStageStatusByKey.has(key)) return stage;
      return {
        ...stage,
        status: nextStageStatusByKey.get(key) ?? null,
      };
    });
    return {
      ...project,
      ownedStages,
      trafficLight: aggregateTrafficLight(ownedStages),
    };
  });

  return { ...section, projects };
}

/**
 * Merge Activity Status Draft.
 * @param section - The section argument.
 * @param activityId - The activityId argument.
 * @param status - The status argument.
 */
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

/**
 * Merge Decision Draft.
 * @param section - The section argument.
 * @param next - The next argument.
 */
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
          stageIds: [] as string[],
        }
      : {
          productId: decision.productId || null,
          activityId: null,
          stageIds: decision.stageIds,
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

/**
 * Merge Risk Draft.
 * @param section - The section argument.
 * @param next - The next argument.
 */
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
          stageIds: [] as string[],
        }
      : {
          projectId: risk.productId,
          activityId: null,
          stageIds: risk.stageIds,
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
  item: KanbanItem,
  itemType: "current" | "next",
  existing: DraftSection["items"][number] | undefined,
) {
  const workflowStatus = persistableItemStatusToWorkflow(item.status);
  const parentFields = item.activityId
    ? {
        projectId: null,
        activityId: item.activityId,
        stageIds: [] as string[],
      }
    : {
        projectId: item.productId,
        activityId: null,
        stageIds: item.stageIds,
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

/**
 * Merge Items Draft.
 * @param section - The section argument.
 * @param itemType - The itemType argument.
 * @param next - The next argument.
 */
export function mergeItemsDraft(
  section: DraftSection,
  itemType: "current" | "next",
  next: readonly KanbanItem[],
): DraftSection {
  const editableItems = next.filter((item) => !item.foreign);
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

/**
 * Patch Draft Item.
 * @param section - The section argument.
 * @param itemId - The itemId argument.
 * @param patch - The patch argument.
 */
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
