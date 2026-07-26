import { deriveItemAlarmFromRisks } from "../../../lib/item-alarm";
import { canonicalStageIds } from "../model/stage-tags";
import type {
  ItemStatus,
  KanbanItem,
  Product,
  RiskEntry,
} from "../model/types";
import { IN_PROGRESS_STATUS } from "./item-status-choices";
import type { ParentActivityOption } from "./parent-picker";

// Stage is required only for product parents with owned stages.
/**
 * Collect Item Errors.
 * @param args - The args argument.
 */
export function collectItemErrors(args: {
  readonly trimmed: string;
  readonly isActivityParent: boolean;
  readonly availableStages: readonly string[];
  readonly effectiveStageIds: readonly string[];
}): { text?: string; stageIds?: string } {
  const stageRequired =
    !args.isActivityParent &&
    args.availableStages.length > 0 &&
    args.effectiveStageIds.length === 0;
  return {
    ...(args.trimmed.length === 0 ? { text: "Description is required" } : {}),
    ...(stageRequired ? { stageIds: "Select at least one stage." } : {}),
  };
}

// Focus order: text → stage → pausedReason; later errors never jump past earlier.
/**
 * First Invalid Control.
 * @param next - The next argument.
 * @param surface - The surface argument.
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

// Covering risk floors live edit for product+stage only; activity severity is isolated.
// Stage-less creates are never pre-locked by the wildcard.
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

// Locked when a covering risk owns the alarm; blockers live in Risks & Blockers only.
/**
 * Resolve Status Slot.
 * @param args - The args argument.
 */
export function resolveStatusSlot(args: CoverageArgs): StatusSlot {
  return isItemCovered(args) ? "locked" : "chips";
}

// A cross-stage record may name a product outside the lead's stage-owned list —
// keep that original assignment instead of reassigning. products.at(0) applies
// only when the picker was never touched and the record has no product of its own.
export function resolveSaveProduct(
  products: readonly Product[],
  record: { readonly productId: string; readonly productName: string } | null,
  parentId: string,
): { id: string; name: string } | undefined {
  return (
    products.find((p) => p.id === parentId) ??
    (record?.productId === parentId
      ? { id: record.productId, name: record.productName }
      : products.at(0))
  );
}

// Offer priority ranks 1..10, plus any legacy rank above 10 already on the item.
const MAX_ITEM_RANK = 10;

/**
 * Build Rank Options.
 * @param existingRank - The existingRank argument.
 */
export function buildRankOptions(existingRank: number | null): number[] {
  const base = Array.from({ length: MAX_ITEM_RANK }, (_, i) => i + 1);
  return existingRank != null && existingRank > MAX_ITEM_RANK
    ? [...base, existingRank]
    : base;
}

/**
 * Resolve Initial Item.
 * @param args - The args argument.
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

// Legacy stored `blocked` opens as in-progress so re-save never re-persists bare blocked.
/**
 * Coerce Initial Status.
 * @param status - The status argument.
 */
export function coerceInitialStatus(status: ItemStatus): ItemStatus {
  return status === "blocked" ? IN_PROGRESS_STATUS : status;
}

/**
 * Resolve Item Parent Name.
 * @param args - The args argument.
 */
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

/**
 * Build Activity Item Save.
 * @param args - The args argument.
 */
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

/**
 * Build Product Item Save.
 * @param args - The args argument.
 */
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
