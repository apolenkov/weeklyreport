import type {
  ReportSectionReadModel,
  TrafficLightStatus,
} from "@customreport/shared";

import type {
  DecisionEntry,
  KanbanItem,
  Product,
  RiskEntry,
} from "../../report-sections";
import {
  mergeActivityStatusDraft,
  mergeDecisionDraft,
  mergeItemsDraft,
  mergeProductDraft,
  mergeRiskDraft,
  patchDraftItem,
} from "./lead-form-draft-merge-helpers";

/**
 * Every draft mutation the lead form performs, as data. The draft module's
 * `apply(patch)` runs these through `setDraftSection` as a functional updater
 * so each patch composes with whatever draft is already pending — concurrent
 * handler fires never clobber each other, and bridge consumers always read
 * the merged section.
 */
export type DraftPatch =
  | { readonly kind: "products"; readonly products: readonly Product[] }
  | {
      readonly kind: "activity-status";
      readonly activityId: string;
      readonly status: TrafficLightStatus;
    }
  | { readonly kind: "risks"; readonly risks: readonly RiskEntry[] }
  | { readonly kind: "decisions"; readonly decisions: readonly DecisionEntry[] }
  | {
      readonly kind: "week-items";
      readonly week: "current" | "next";
      readonly items: readonly KanbanItem[];
    }
  | {
      readonly kind: "item-patch";
      readonly itemId: string;
      readonly patch: Partial<ReportSectionReadModel["items"][number]>;
    };

/** Pure reducer: applies one draft patch to a section, returning a new section. */
export function applyDraftPatch(
  section: ReportSectionReadModel,
  patch: DraftPatch,
): ReportSectionReadModel {
  switch (patch.kind) {
    case "products":
      return mergeProductDraft(section, patch.products);
    case "activity-status":
      return mergeActivityStatusDraft(section, patch.activityId, patch.status);
    case "risks":
      return mergeRiskDraft(section, patch.risks);
    case "decisions":
      return mergeDecisionDraft(section, patch.decisions);
    case "week-items":
      return mergeItemsDraft(section, patch.week, patch.items);
    case "item-patch":
      return patchDraftItem(section, patch.itemId, patch.patch);
  }
}
