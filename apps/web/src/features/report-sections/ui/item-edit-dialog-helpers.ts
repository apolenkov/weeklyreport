import { deriveItemAlarmFromRisks } from "../../../lib/item-alarm";
import { canonicalStageIds } from "../model/stage-tags";
import type {
  ItemStatus,
  KanbanItem,
  Product,
  RiskEntry,
} from "../model/types";
import { IN_PROGRESS_STATUS } from "./item-status-choices";
import type { ParentActivityOption } from "./product-picker";

/**
 * Per-field validation for the item save. A stage is required only for a
 * product parent with owned stages; an activity owns no stage, so it is never
 * demanded there.
 */
export function collectItemErrors(args: {
  readonly trimmed: string;
  readonly isActivityParent: boolean;
  readonly availableStages: readonly string[];
  readonly effectiveStageIds: readonly string[];
}): { text?: string; stageIds?: string } {
  const errors: { text?: string; stageIds?: string } = {};
  if (args.trimmed.length === 0) errors.text = "Description is required";
  if (
    !args.isActivityParent &&
    args.availableStages.length > 0 &&
    args.effectiveStageIds.length === 0
  )
    errors.stageIds = "Select at least one stage.";
  return errors;
}

/**
 * The first invalid control in DOM order — text, then the stage fieldset,
 * then the paused-reason field. A later error must never steal focus past an
 * earlier one (a pausedReason error does not outrank a missing stage).
 */
export function firstInvalidControl(
  next: { text?: string; stageIds?: string; pausedReason?: string },
  surface: HTMLElement | null,
): HTMLElement | null {
  if (next.text) return document.getElementById("item-text");
  if (next.stageIds) {
    return (
      surface?.querySelector<HTMLElement>('fieldset input[type="checkbox"]') ??
      null
    );
  }
  if (next.pausedReason) return document.getElementById("item-paused-reason");
  return null;
}

export interface CoverageArgs {
  readonly isActivityParent: boolean;
  readonly productId: string;
  readonly stageIds: readonly string[];
  readonly status: ItemStatus;
  readonly risks: readonly RiskEntry[] | undefined;
}

/**
 * Whether a covering risk floors the item in its LIVE edit state. `status` is
 * already coerced (a stored blocked opens as in-progress), so this floors to the
 * risk's severity exactly as the card does. Product parents with a concrete
 * stage only — an activity item's severity stays isolated, and a stage-less row
 * (a fresh create before a stage is picked) is never pre-locked by the wildcard.
 */
function isItemCovered(args: CoverageArgs): boolean {
  if (args.isActivityParent || args.productId === "") return false;
  if (args.stageIds.length === 0) return false;
  return (
    deriveItemAlarmFromRisks(
      {
        productId: args.productId,
        stageIds: args.stageIds,
        status: args.status,
      },
      args.risks ?? [],
    ) !== null
  );
}

export type StatusSlot = "locked" | "chips";

/**
 * The status slot to render: `locked` (a covering risk owns the alarm) or the
 * per-type progress `chips`. No in-dialog blocker gesture exists — blockers
 * are created in Risks & Blockers (rework-item-status-model).
 */
export function resolveStatusSlot(args: CoverageArgs): StatusSlot {
  return isItemCovered(args) ? "locked" : "chips";
}

/**
 * Resolve the product a product-parented save writes to. A cross-stage row may
 * reference a project outside the lead's stage-owned `products`, so keep the
 * original assignment instead of silently reassigning to the first product.
 */
export function resolveSaveProduct(
  products: readonly Product[],
  item: KanbanItem | null,
  parentId: string,
): { id: string; name: string } | undefined {
  return (
    products.find((p) => p.id === parentId) ??
    (item?.productId === parentId
      ? { id: item.productId, name: item.productName }
      : products.at(0))
  );
}

// Offer priority ranks 1..10, plus any legacy rank above 10 already on the item.
const MAX_ITEM_RANK = 10;

export function buildRankOptions(existingRank: number | null): number[] {
  const base = Array.from({ length: MAX_ITEM_RANK }, (_, i) => i + 1);
  return existingRank != null && existingRank > MAX_ITEM_RANK
    ? [...base, existingRank]
    : base;
}

/**
 * The mount-time seed for the dialog's local state: the bound item on edit, or
 * a fresh create-mode row seeded from the column's product and the current
 * user.
 */
export function resolveInitialItem(args: {
  readonly item: KanbanItem | null;
  readonly week: "current" | "next";
  readonly seedProduct: Product | undefined;
  readonly currentUserName: string | undefined;
}): KanbanItem {
  if (args.item) return args.item;
  return {
    id: "",
    productId: args.seedProduct?.id ?? "",
    productName: args.seedProduct?.name ?? "",
    status: args.week === "current" ? IN_PROGRESS_STATUS : "planned",
    text: "",
    author: args.currentUserName ?? "You",
  };
}

// record-status-derived-from-risk: a legacy stored `blocked` opens as
// in-progress — `blocked` is no longer a free item status (the covering risk
// owns the alarm), so re-saving never re-persists a bare `blocked`.
export function coerceInitialStatus(status: ItemStatus): ItemStatus {
  return status === "blocked" ? IN_PROGRESS_STATUS : status;
}

/** The header's parent name — the activity or the product, edit- or create-seeded. */
export function resolveItemParentName(args: {
  readonly isActivityParent: boolean;
  readonly selectedActivity: ParentActivityOption | undefined;
  readonly selectedProduct: Product | undefined;
  readonly initial: KanbanItem;
}): string {
  if (args.isActivityParent)
    return args.selectedActivity?.name ?? args.initial.activityName ?? "";
  return args.selectedProduct?.name ?? args.initial.productName;
}

interface ItemSaveCommonArgs {
  readonly item: KanbanItem | null;
  readonly trimmed: string;
  readonly status: ItemStatus;
  readonly currentUserName: string | undefined;
  readonly priorityRank: number | null;
  readonly trimmedPausedReason: string;
}

/** Builds the activity-parented save payload — empty productId, no stage. */
export function buildActivityItemSave(
  args: ItemSaveCommonArgs & {
    readonly selectedActivity: ParentActivityOption | undefined;
    readonly initial: KanbanItem;
    readonly activityId: string;
  },
): KanbanItem {
  return {
    id: args.item?.id ?? crypto.randomUUID(),
    productId: "",
    productName: args.selectedActivity?.name ?? args.initial.activityName ?? "",
    activityId: args.activityId,
    activityName: args.selectedActivity?.name ?? args.initial.activityName,
    text: args.trimmed,
    status: args.status,
    author: args.item?.author ?? args.currentUserName ?? "You",
    priorityRank: args.priorityRank ?? null,
    pausedReason: args.status === "paused" ? args.trimmedPausedReason : null,
  };
}

/** Builds the product-parented save payload. */
export function buildProductItemSave(
  args: ItemSaveCommonArgs & {
    readonly product: { id: string; name: string };
    readonly effectiveStageIds: readonly string[];
  },
): KanbanItem {
  return {
    id: args.item?.id ?? crypto.randomUUID(),
    productId: args.product.id,
    productName: args.product.name,
    activityId: null,
    stageIds:
      args.effectiveStageIds.length > 0
        ? canonicalStageIds(args.effectiveStageIds)
        : undefined,
    text: args.trimmed,
    status: args.status,
    author: args.item?.author ?? args.currentUserName ?? "You",
    priorityRank: args.priorityRank ?? null,
    pausedReason: args.status === "paused" ? args.trimmedPausedReason : null,
  };
}
