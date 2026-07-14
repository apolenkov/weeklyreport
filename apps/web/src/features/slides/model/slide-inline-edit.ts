import type { ReportSectionReadModel } from "@customreport/shared";

import type {
  DecisionEntry,
  KanbanItem,
  LeadDecisionEntry,
  LeadKanbanItem,
  LeadRiskEntry,
  MappedLeadForm,
  Product,
  RiskEntry,
} from "../../report-sections";
import type { GridRowEditableRef } from "./slide-grid-rows";

export type SlideInlineEditRecord =
  | {
      readonly kind: "item";
      readonly ref: GridRowEditableRef;
      readonly item: KanbanItem;
      readonly week: "current" | "next";
      readonly deleteTitle: string;
      readonly deletePreview: string;
      readonly deleteSubtitle?: string;
    }
  | {
      readonly kind: "risk";
      readonly ref: GridRowEditableRef;
      readonly risk: RiskEntry;
      readonly deleteTitle: string;
      readonly deletePreview: string;
      readonly deleteSubtitle?: string;
    }
  | {
      readonly kind: "decision";
      readonly ref: GridRowEditableRef;
      readonly decision: DecisionEntry;
      readonly deleteTitle: string;
      readonly deletePreview: string;
      readonly deleteSubtitle?: string;
    };

export function toDialogProducts(data: MappedLeadForm): Product[] {
  return data.products.map((product) => ({
    ...product,
    stages: product.stages.map((stage) => ({ ...stage })),
  }));
}

export function toDialogRisks(data: MappedLeadForm): RiskEntry[] {
  return data.risks.map(toRiskEntry);
}

export function toDialogActivities(
  section: ReportSectionReadModel,
): readonly { id: string; name: string }[] {
  return section.activities.map((activity) => ({
    id: activity.activityId,
    name: activity.activityName,
  }));
}

export function ownPeriodRanks(data: MappedLeadForm): readonly number[] {
  return [...data.currentWeekItems, ...data.nextWeekItems]
    .map((item) => item.priorityRank)
    .filter((rank): rank is number => rank != null);
}

export function ownedStagesForProduct(
  section: ReportSectionReadModel,
  productId: string,
): readonly string[] {
  return (
    section.projects
      .find((project) => project.projectId === productId)
      ?.ownedStages?.map((stage) => stage.stageName) ?? []
  );
}

export function resolveSlideInlineRecord(
  section: ReportSectionReadModel,
  data: MappedLeadForm,
  ref: GridRowEditableRef,
): SlideInlineEditRecord | null {
  switch (ref.kind) {
    case "item":
      return resolveItemRecord(section, data, ref);
    case "risk":
      return resolveRiskRecord(section, data, ref);
    case "decision":
      return resolveDecisionRecord(section, data, ref);
  }
}

function resolveItemRecord(
  section: ReportSectionReadModel,
  data: MappedLeadForm,
  ref: GridRowEditableRef,
): SlideInlineEditRecord | null {
  const raw = section.items.find((item) => item.stableId === ref.stableId);
  if (!raw) return null;
  const list =
    raw.type === "current" ? data.currentWeekItems : data.nextWeekItems;
  const item = list.find((entry) => entry.id === raw.id);
  if (!item) return null;
  return {
    kind: "item",
    ref,
    item: toKanbanItem(item),
    week: raw.type,
    deleteTitle:
      raw.type === "next" ? "Delete next-week item?" : "Delete item?",
    deletePreview: item.text,
    deleteSubtitle: `From ${item.productName}`,
  };
}

function resolveRiskRecord(
  section: ReportSectionReadModel,
  data: MappedLeadForm,
  ref: GridRowEditableRef,
): SlideInlineEditRecord | null {
  const raw = section.risks.find((risk) => risk.stableId === ref.stableId);
  if (!raw) return null;
  const risk = data.risks.find((entry) => entry.id === raw.id);
  if (!risk) return null;
  return {
    kind: "risk",
    ref,
    risk: toRiskEntry(risk),
    deleteTitle: "Delete risk?",
    deletePreview: risk.text || "(no description)",
    deleteSubtitle: `${risk.productName} · ${risk.stageIds?.join(", ") || "no stage set"}`,
  };
}

function resolveDecisionRecord(
  section: ReportSectionReadModel,
  data: MappedLeadForm,
  ref: GridRowEditableRef,
): SlideInlineEditRecord | null {
  const raw = section.decisions.find(
    (decision) => decision.stableId === ref.stableId,
  );
  if (!raw) return null;
  const decision = data.decisions.find((entry) => entry.id === raw.id);
  if (!decision) return null;
  return {
    kind: "decision",
    ref,
    decision: toDecisionEntry(decision),
    deleteTitle: "Delete decision?",
    deletePreview: decision.text || "(no description)",
    deleteSubtitle: `Owner: ${decision.owner}`,
  };
}

function toKanbanItem(item: LeadKanbanItem): KanbanItem {
  return {
    ...item,
    ...(item.stageIds ? { stageIds: [...item.stageIds] } : {}),
  };
}

function toRiskEntry(risk: LeadRiskEntry): RiskEntry {
  return {
    ...risk,
    ...(risk.stageIds ? { stageIds: [...risk.stageIds] } : {}),
  };
}

function toDecisionEntry(decision: LeadDecisionEntry): DecisionEntry {
  return {
    ...decision,
    ...(decision.stageIds ? { stageIds: [...decision.stageIds] } : {}),
  };
}
