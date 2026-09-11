import type { ReportSectionReadModel } from "@customreport/shared";

import { deriveItemStatus } from "./item-status";
import { buildActivityIndex, buildProjectIndex } from "./lead-form-shared";
import type { KanbanItem } from "./types";

export type LeadKanbanItem = KanbanItem & {
  priorityRank: number | null;
  pausedReason: string | null;
};

type SectionItem = ReportSectionReadModel["items"][number];

function buildLeadItemCommon(
  item: SectionItem,
  section: ReportSectionReadModel,
) {
  return {
    id: requireItemId(item),
    status: deriveItemStatus({
      workflowStatus: item.workflowStatus,
      type: item.type,
    }),
    text: item.text,
    author: section.authorName,
    stageNames: item.stageNames,
    priorityRank: item.priorityRank ?? null,
    pausedReason: item.pausedReason ?? null,
    nextStepText: item.nextStepText ?? null,
  };
}

function requireItemId(item: SectionItem): string {
  if (typeof item.id === "string" && item.id.length > 0) return item.id;
  throw new Error("Item is missing id");
}

function mapLeadItem(
  item: SectionItem,
  section: ReportSectionReadModel,
  projectIndex: ReturnType<typeof buildProjectIndex>,
  activityNameById: ReturnType<typeof buildActivityIndex>,
): LeadKanbanItem[] {
  const common = buildLeadItemCommon(item, section);
  if (item.activityId != null) {
    const activityName = activityNameById.get(item.activityId) ?? "Unknown";
    return [
      {
        ...common,
        parent: { kind: "activity" as const, id: item.activityId },
        productId: null,
        productName: activityName,
        activityId: item.activityId,
        activityName,
      },
    ];
  }
  if (item.projectId == null) return [];
  return [
    {
      ...common,
      parent: { kind: "product" as const, id: item.projectId },
      productId: item.projectId,
      productName: projectIndex.get(item.projectId)?.name ?? "Unknown",
      activityId: null,
    },
  ];
}

export function mapLeadItems(
  section: ReportSectionReadModel,
  itemType: "current" | "next",
): LeadKanbanItem[] {
  const projectIndex = buildProjectIndex(section);
  const activityNameById = buildActivityIndex(section);
  // Rows with EITHER parent render in the week sections — product rows under
  // their product column, activity rows under their activity lane
  // (splitItemBoard). A row with neither parent is malformed and stays
  // excluded.
  return section.items
    .filter(
      (item) =>
        item.type === itemType &&
        (item.projectId != null || item.activityId != null),
    )
    .flatMap((item) =>
      mapLeadItem(item, section, projectIndex, activityNameById),
    );
}
