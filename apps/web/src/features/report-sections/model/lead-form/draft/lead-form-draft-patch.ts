import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@weeklyreport/shared";

import {
  buildMoveItemPatch,
  markCompletePatch,
  pauseItemPatch,
} from "../../lead-actions/lead-item-actions";
import { trafficToStageStatus } from "../../traffic-light";
import type {
  DecisionEntry,
  KanbanItem,
  Product,
  ProductsUpdater,
  RiskEntry,
} from "../../types";
import {
  confirmCarriedDraft,
  mergeActivityStatusDraft,
  mergeDecisionDraft,
  mergeItemsDraft,
  mergeProductDraft,
  mergeRiskDraft,
  patchDraftItem,
} from "./lead-form-draft-merge-helpers";

// Each patch applies to the latest section; collection patches replace their
// owned collection, while item patches update one identified row.
export type DraftPatch =
  | { readonly kind: "products"; readonly products: ProductsUpdater }
  | {
      readonly kind: "activity-status";
      readonly activityId: string;
      // Partial activity fields: omitted keys preserve the persisted value.
      readonly status?: TrafficLightStatus;
      readonly titleOverride?: string | null;
      readonly note?: string | null;
    }
  | { readonly kind: "risks"; readonly risks: readonly RiskEntry[] }
  | { readonly kind: "decisions"; readonly decisions: readonly DecisionEntry[] }
  | {
      readonly kind: "week-items";
      readonly week: "current" | "next";
      readonly items: readonly KanbanItem[];
    }
  | { readonly kind: "confirm-carried" }
  | {
      readonly kind: "move-item";
      readonly itemId: string;
      readonly target: "current" | "next";
    }
  | { readonly kind: "complete-item"; readonly itemId: string }
  | {
      readonly kind: "pause-item";
      readonly itemId: string;
      readonly reason: string;
    }
  | {
      readonly kind: "item-patch";
      readonly itemId: string;
      readonly patch: Partial<ReportSectionReadModel["items"][number]>;
    };

// Functional updates author raw owned statuses; display risk floors never enter the draft.
function rawProducts(section: ReportSectionReadModel): Product[] {
  return section.projects.map((project) => ({
    id: project.projectId,
    name: project.projectName,
    overallStatus: trafficToStageStatus(project.trafficLight),
    stages: project.ownedStages.map((stage) => ({
      stageName: stage.stageName,
      status: trafficToStageStatus(stage.status ?? null),
      ownership: "mine",
      assignee: section.authorName,
    })),
  }));
}

type ItemCommand = Extract<
  DraftPatch,
  { readonly kind: "move-item" | "complete-item" | "pause-item" }
>;

function applyItemCommand(
  section: ReportSectionReadModel,
  command: ItemCommand,
): ReportSectionReadModel {
  if (command.kind === "move-item") {
    const next = buildMoveItemPatch(section, command.itemId, command.target);
    return next?.kind === "item-patch"
      ? patchDraftItem(section, next.itemId, next.patch)
      : section;
  }
  const item = section.items.find(
    (candidate) => candidate.id === command.itemId,
  );
  if (
    section.status !== "draft" ||
    !item ||
    item.resolution != null ||
    item.workflowStatus === "done"
  )
    return section;
  if (
    command.kind === "pause-item" &&
    (item.workflowStatus !== "in_progress" || !command.reason.trim())
  )
    return section;
  return patchDraftItem(
    section,
    command.itemId,
    command.kind === "complete-item"
      ? { ...markCompletePatch(), pausedReason: null }
      : pauseItemPatch(command.reason),
  );
}

export function applyDraftPatch(
  section: ReportSectionReadModel,
  patch: DraftPatch,
): ReportSectionReadModel {
  switch (patch.kind) {
    case "products":
      return mergeProductDraft(
        section,
        typeof patch.products === "function"
          ? patch.products(rawProducts(section))
          : patch.products,
      );
    case "move-item":
    case "complete-item":
    case "pause-item":
      return applyItemCommand(section, patch);
    case "activity-status":
      return mergeActivityStatusDraft(section, patch.activityId, {
        ...(patch.status === undefined ? {} : { status: patch.status }),
        ...(patch.titleOverride === undefined
          ? {}
          : { titleOverride: patch.titleOverride }),
        ...(patch.note === undefined ? {} : { note: patch.note }),
      });
    case "risks":
      return mergeRiskDraft(section, patch.risks);
    case "decisions":
      return mergeDecisionDraft(section, patch.decisions);
    case "week-items":
      return mergeItemsDraft(section, patch.week, patch.items);
    case "confirm-carried":
      return confirmCarriedDraft(section);
    case "item-patch":
      return patchDraftItem(section, patch.itemId, patch.patch);
  }
}
