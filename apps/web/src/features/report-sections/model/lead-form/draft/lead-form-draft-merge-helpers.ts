import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@weeklyreport/shared";

import { persistableItemStatusToWorkflow } from "../../item-status";
import { isUnconfirmedCarried } from "../../lead-actions/lead-item-actions";
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
  fields: {
    readonly status?: TrafficLightStatus;
    readonly titleOverride?: string | null;
    readonly note?: string | null;
  },
): DraftSection {
  return {
    ...section,
    activities: section.activities.map((activity) =>
      activity.activityId === activityId
        ? { ...activity, ...fields }
        : activity,
    ),
  };
}

interface Identity {
  readonly id?: string | undefined;
  readonly stableId?: string | undefined;
}

function addUniqueIdentity(
  value: string | undefined,
  seen: Set<string>,
  error: string,
) {
  if (value && seen.has(value)) throw new Error(error);
  if (value) seen.add(value);
}

function validateIdentities(rows: readonly Identity[]) {
  const ids = new Set<string>();
  const stableIds = new Set<string>();
  for (const row of rows) {
    addUniqueIdentity(row.id, ids, "Duplicate record id");
    addUniqueIdentity(row.stableId, stableIds, "Duplicate record lineage");
  }
}

function identityMatcher<T extends Identity>(
  existing: readonly T[],
  next: readonly Identity[],
) {
  const byId = new Map<string, T>();
  const byStable = new Map<string, T>();
  validateIdentities(existing);
  validateIdentities(next);
  for (const row of existing) {
    if (row.id) byId.set(row.id, row);
    if (row.stableId) byStable.set(row.stableId, row);
  }
  const claimed = new Set<T>();
  return (row: Identity): T | undefined => {
    const byPhysical = row.id ? byId.get(row.id) : undefined;
    const byLineage = row.stableId ? byStable.get(row.stableId) : undefined;
    if (
      byPhysical &&
      row.stableId &&
      byPhysical.stableId &&
      row.stableId !== byPhysical.stableId
    )
      throw new Error("Record id and lineage mismatch");
    if (byLineage && byPhysical && byLineage !== byPhysical)
      throw new Error("Record id and lineage mismatch");
    const match = byLineage ?? byPhysical;
    if (match && claimed.has(match))
      throw new Error("Duplicate record lineage");
    if (match) claimed.add(match);
    return match;
  };
}

export function mergeDecisionDraft(
  section: DraftSection,
  next: readonly DecisionEntry[],
): DraftSection {
  const editableDecisions = next.filter((decision) => !decision.foreign);
  const match = identityMatcher(section.decisions, editableDecisions);
  const decisions = editableDecisions.map((decision) => {
    const existing = match(decision);
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
        stableId: existing.stableId ?? decision.stableId,
        ...parentFields,
        text: decision.text,
        owner: decision.owner,
        impact: decision.impact,
        deadline,
      };
    }
    return {
      id: decision.id,
      stableId: decision.stableId,
      ...parentFields,
      text: decision.text,
      owner: decision.owner,
      impact: decision.impact,
      deadline,
      resolvedAt: null,
    };
  });
  return { ...section, decisions };
}

export function mergeRiskDraft(
  section: DraftSection,
  next: readonly RiskEntry[],
): DraftSection {
  const editableRisks = next.filter((risk) => !risk.foreign);
  const match = identityMatcher(section.risks, editableRisks);
  const risks = editableRisks.map((risk) => {
    const existing = match(risk);
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
        stableId: existing.stableId ?? risk.stableId,
        ...parentFields,
        risk: risk.text,
        impact: risk.impact,
        mitigation: risk.mitigation,
        severity: risk.severity,
      };
    }
    return {
      id: risk.id,
      stableId: risk.stableId,
      ...parentFields,
      risk: risk.text,
      impact: risk.impact,
      mitigation: risk.mitigation,
      severity: risk.severity,
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
      nextStepText:
        item.nextStepText === undefined
          ? (existing.nextStepText ?? null)
          : item.nextStepText,
      workflowStatus,
      priorityRank: item.priorityRank ?? null,
      pausedReason,
    };
  }
  return {
    id: item.id,
    stableId: item.stableId,
    ...parentFields,
    type: itemType,
    text: item.text,
    nextStepText: item.nextStepText ?? null,
    tag: item.tag ?? "general",
    workflowStatus,
    carriedOver: false,
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

export function confirmCarriedDraft(section: DraftSection): DraftSection {
  return {
    ...section,
    items: section.items.map((item) =>
      isUnconfirmedCarried(item) ? { ...item, carriedOver: false } : item,
    ),
  };
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
