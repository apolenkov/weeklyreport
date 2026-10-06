import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";

import type {
  DecisionEntry,
  KanbanItem,
  Product,
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
  | { readonly kind: "products"; readonly products: readonly Product[] }
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
      readonly kind: "item-patch";
      readonly itemId: string;
      readonly patch: Partial<ReportSectionReadModel["items"][number]>;
    };

export function applyDraftPatch(
  section: ReportSectionReadModel,
  patch: DraftPatch,
): ReportSectionReadModel {
  switch (patch.kind) {
    case "products":
      return mergeProductDraft(section, patch.products);
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
