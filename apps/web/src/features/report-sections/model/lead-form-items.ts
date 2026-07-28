import type { ReportSectionReadModel } from "@customreport/shared";

import { deriveItemStatus } from "./item-status";
import { buildActivityIndex, buildProjectIndex } from "./lead-form-shared";
import type { KanbanItem } from "./types";

/** Mapper guarantees: priorityRank and pausedReason are always populated (null = absent). */
export type LeadKanbanItem = KanbanItem & {
  priorityRank: number | null;
  pausedReason: string | null;
};

// Truncation length for a fallback id's embedded text fragment.
const ID_TEXT_FRAGMENT_LENGTH = 8;

/**
 * Map a section's items (filtered by `type`) into KanbanItems.
 *
 * Each item's display status flows through `deriveItemStatus`.
 * Product name is resolved via `section.projects[i].projectName`.
 */
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
    .map((item) => {
      const activityName =
        item.activityId != null
          ? (activityNameById.get(item.activityId) ?? "Unknown")
          : undefined;
      const project =
        item.projectId != null ? projectIndex.get(item.projectId) : undefined;
      const status = deriveItemStatus({
        workflowStatus: item.workflowStatus,
        type: item.type,
      });
      return {
        id:
          item.id ??
          `${itemType}-${item.projectId ?? item.activityId ?? "row"}-${item.text.slice(0, ID_TEXT_FRAGMENT_LENGTH)}`,
        productId: item.projectId ?? "",
        // An activity row's display parent is the activity itself.
        productName: project?.name ?? activityName ?? "Unknown",
        ...(item.activityId != null
          ? { activityId: item.activityId, activityName }
          : {}),
        // Stage array from DB — surfaces on the kanban card and groups items
        // by product+stage. Undefined for legacy rows seeded before the
        // column existed.
        ...(item.stageNames ? { stageNames: item.stageNames } : {}),
        status,
        text: item.text,
        author: section.authorName,
        // priorityRank rides the bound KanbanItem so ItemEditDialog
        // re-populates the field on reopen (dropping it left the field empty
        // after reload even though the value persisted).
        priorityRank: item.priorityRank ?? null,
        // require-paused-item-reason: surfaced on the card and round-tripped
        // through sectionToDraftPayload so it survives a save.
        pausedReason: item.pausedReason ?? null,
      };
    });
}
