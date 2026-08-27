import type { ReportSectionReadModel } from "@customreport/shared";

import { deriveItemStatus } from "./item-status";
import { buildActivityIndex, buildProjectIndex } from "./lead-form-shared";
import type { KanbanItem } from "./types";

export type LeadKanbanItem = KanbanItem & {
  priorityRank: number | null;
  pausedReason: string | null;
};

// Truncation length for a fallback id's embedded text fragment.
const ID_TEXT_FRAGMENT_LENGTH = 8;

type SectionItem = ReportSectionReadModel["items"][number];

function buildLeadItemCommon(
  item: SectionItem,
  section: ReportSectionReadModel,
  itemType: "current" | "next",
) {
  return {
    id:
      item.id ??
      `${itemType}-${item.projectId ?? item.activityId ?? "row"}-${item.text.slice(0, ID_TEXT_FRAGMENT_LENGTH)}`,
    status: deriveItemStatus({
      workflowStatus: item.workflowStatus,
      type: item.type,
    }),
    text: item.text,
    author: section.authorName,
    ...(item.stageNames ? { stageNames: item.stageNames } : {}),
    priorityRank: item.priorityRank ?? null,
    pausedReason: item.pausedReason ?? null,
  };
}

function mapLeadItem(
  item: SectionItem,
  section: ReportSectionReadModel,
  itemType: "current" | "next",
  projectIndex: ReturnType<typeof buildProjectIndex>,
  activityNameById: ReturnType<typeof buildActivityIndex>,
): LeadKanbanItem[] {
  const common = buildLeadItemCommon(item, section, itemType);
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
      mapLeadItem(item, section, itemType, projectIndex, activityNameById),
    );
}
