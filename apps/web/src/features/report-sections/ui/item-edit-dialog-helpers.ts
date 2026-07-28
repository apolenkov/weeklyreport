import { deriveItemAlarmFromRisks } from "../../../lib/item-alarm";
import { canonicalStageNames } from "../model/stage-tags";
import type {
  ItemStatus,
  KanbanItem,
  Product,
  RiskEntry,
} from "../model/types";
import { IN_PROGRESS_STATUS } from "./item-status-choices";
import type { ParentActivityOption } from "./parent-picker";

// Stage is required only for product parents with owned stages.
export function collectItemErrors(args: {
  readonly trimmed: string;
  readonly isActivityParent: boolean;
  readonly availableStages: readonly string[];
  readonly effectiveStageNames: readonly string[];
}): { text?: string; stageNames?: string } {
  const stageRequired =
    !args.isActivityParent &&
    args.availableStages.length > 0 &&
    args.effectiveStageNames.length === 0;
  return {
    ...(args.trimmed.length === 0 ? { text: "Description is required" } : {}),
    ...(stageRequired ? { stageNames: "Select at least one stage." } : {}),
  };
}

// Focus order: text → stage → pausedReason; later errors never jump past earlier.
export function firstInvalidControl(
  next: {
    text?: string | undefined;
    stageNames?: string | undefined;
    pausedReason?: string | undefined;
  },
  surface: HTMLElement | null,
): HTMLElement | null {
  if (next.text) return document.getElementById("item-text");
  if (next.stageNames) {
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
  readonly stageNames: readonly string[];
  readonly status: ItemStatus;
  readonly risks: readonly RiskEntry[] | undefined;
}

// Covering risk floors live edit for product+stage only; activity severity is isolated.
// Stage-less creates are never pre-locked by the wildcard.
function isItemCovered(args: CoverageArgs): boolean {
  if (args.isActivityParent || args.productId === "") return false;
  if (args.stageNames.length === 0) return false;
  return (
    deriveItemAlarmFromRisks(
      {
        productId: args.productId,
        stageNames: args.stageNames,
        status: args.status,
      },
      args.risks ?? [],
    ) !== null
  );
}

export type StatusSlot = "locked" | "chips";

// Locked when a covering risk owns the alarm; blockers live in Risks & Blockers only.
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

export function buildRankOptions(existingRank: number | null): number[] {
  const base = Array.from({ length: MAX_ITEM_RANK }, (_, i) => i + 1);
  return existingRank != null && existingRank > MAX_ITEM_RANK
    ? [...base, existingRank]
    : base;
}

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
export function coerceInitialStatus(status: ItemStatus): ItemStatus {
  return status === "blocked" ? IN_PROGRESS_STATUS : status;
}

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

export function buildProductItemSave(
  args: ItemSaveCommonArgs & {
    readonly product: { id: string; name: string };
    readonly effectiveStageNames: readonly string[];
  },
): KanbanItem {
  return {
    id: args.item?.id ?? crypto.randomUUID(),
    productId: args.product.id,
    productName: args.product.name,
    activityId: null,
    stageNames:
      args.effectiveStageNames.length > 0
        ? canonicalStageNames(args.effectiveStageNames)
        : undefined,
    text: args.trimmed,
    status: args.status,
    author: args.item?.author ?? args.currentUserName ?? "You",
    priorityRank: args.priorityRank ?? null,
    pausedReason: args.status === "paused" ? args.trimmedPausedReason : null,
  };
}
