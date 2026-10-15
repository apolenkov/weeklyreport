import {
  hasVisibleText,
  INVISIBLE_TEXT_MESSAGE,
  SAFE_TEXT_MAX_LENGTH,
  safeText,
} from "@weeklyreport/shared";

import { deriveItemAlarmFromRisks } from "../model/alarms/item-alarm";
import type { ParentActivityOption } from "../model/record-parent";
import { canonicalStageNames } from "../model/stage-tags";
import type {
  ItemStatus,
  KanbanItem,
  Product,
  RiskEntry,
} from "../model/types";
import { IN_PROGRESS_STATUS } from "./item-status-choices";

const itemDescriptionSchema = safeText();

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
  const description = itemDescriptionSchema.safeParse(args.trimmed);
  const textError =
    args.trimmed.length === 0
      ? "Description is required"
      : description.success
        ? undefined
        : args.trimmed.length > SAFE_TEXT_MAX_LENGTH
          ? `Description must be ${SAFE_TEXT_MAX_LENGTH} characters or fewer.`
          : description.error.issues[0]?.message;
  return {
    ...(textError ? { text: textError } : {}),
    ...(stageRequired ? { stageNames: "Select at least one stage." } : {}),
  };
}

// Save and status changes apply the same normalized status-dependent rules.
export function collectItemStatusErrors(args: {
  readonly status: ItemStatus;
  readonly trimmedNextStepText: string;
  readonly trimmedPausedReason: string;
}): { nextStepText?: string; pausedReason?: string } {
  return {
    ...(Array.from(args.trimmedNextStepText).length > SAFE_TEXT_MAX_LENGTH
      ? {
          nextStepText: `Next step must be ${SAFE_TEXT_MAX_LENGTH} characters or fewer.`,
        }
      : {}),
    // The server refuses invisible-only text; the editor refuses it too.
    ...(args.trimmedNextStepText.length > 0 &&
    !hasVisibleText(args.trimmedNextStepText)
      ? { nextStepText: INVISIBLE_TEXT_MESSAGE }
      : {}),
    ...(args.status === "completed" && args.trimmedNextStepText.length > 0
      ? {
          nextStepText:
            "A completed item cannot have a next step. Resume it or clear the plan.",
        }
      : {}),
    ...(args.status === "paused" && !hasVisibleText(args.trimmedPausedReason)
      ? { pausedReason: "A reason is required to pause an item." }
      : {}),
    ...(args.status === "paused" &&
    Array.from(args.trimmedPausedReason).length > SAFE_TEXT_MAX_LENGTH
      ? {
          pausedReason: `Pause reason must be ${SAFE_TEXT_MAX_LENGTH} characters or fewer.`,
        }
      : {}),
  };
}

// Focus order: text → next step → stage → paused reason; later errors never
// jump past earlier fields.
export function firstInvalidControl(
  next: {
    text?: string | undefined;
    nextStepText?: string | undefined;
    parent?: string | undefined;
    stageNames?: string | undefined;
    pausedReason?: string | undefined;
  },
  surface: HTMLElement | null,
): HTMLElement | null {
  if (next.text) return document.getElementById("item-text");
  if (next.nextStepText) return document.getElementById("item-next-step");
  if (next.parent) return document.getElementById("item-product");
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
  readonly productId: string | null | undefined;
  readonly stageNames: readonly string[];
  readonly status: ItemStatus;
  readonly risks: readonly RiskEntry[] | undefined;
}

// Covering risk floors live edit for product+stage only; activity severity is isolated.
function isItemCovered(args: CoverageArgs): boolean {
  if (args.isActivityParent || !args.productId) return false;
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

// Resolve the explicitly selected product, or preserve the matching product
// identity carried by an existing cross-stage record.
export function resolveSaveProduct(
  products: readonly Product[],
  record: {
    readonly productId: string | null;
    readonly productName: string;
  } | null,
  parentId: string | undefined,
): { id: string; name: string } | undefined {
  return (
    (parentId ? products.find((p) => p.id === parentId) : undefined) ??
    (parentId !== undefined && record?.productId === parentId
      ? { id: record.productId, name: record.productName }
      : undefined)
  );
}

// Offer standard priority ranks and retain an existing higher rank for editing.
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
  const common = {
    id: "",
    status: args.week === "current" ? IN_PROGRESS_STATUS : "planned",
    text: "",
    author: args.currentUserName ?? "",
  } as const;
  return args.seedProduct
    ? {
        ...common,
        parent: { kind: "product", id: args.seedProduct.id },
        productId: args.seedProduct.id,
        productName: args.seedProduct.name,
        activityId: null,
        stageNames: [],
      }
    : {
        ...common,
        parent: { kind: "unresolved" },
        productId: null,
        productName: "",
        activityId: null,
        stageNames: [],
      };
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
  readonly stableId?: string | undefined;
  readonly tag?: string | undefined;
  readonly trimmed: string;
  readonly status: ItemStatus;
  readonly currentUserName: string | undefined;
  readonly priorityRank: number | null;
  readonly trimmedNextStepText: string;
  readonly trimmedPausedReason: string;
}

function buildItemSaveCommon(args: ItemSaveCommonArgs) {
  return {
    id: args.item?.id ?? crypto.randomUUID(),
    stableId: args.item?.stableId ?? args.stableId,
    tag: args.item?.tag ?? args.tag,
    text: args.trimmed,
    status: args.status,
    author: args.item?.author ?? args.currentUserName ?? "",
    priorityRank: args.priorityRank ?? null,
    nextStepText:
      args.trimmedNextStepText.length === 0 ? null : args.trimmedNextStepText,
    pausedReason: args.status === "paused" ? args.trimmedPausedReason : null,
  };
}

export function buildActivityItemSave(
  args: ItemSaveCommonArgs & {
    readonly selectedActivity: ParentActivityOption | undefined;
    readonly initial: KanbanItem;
    readonly activityId: string;
  },
): KanbanItem {
  const activityName =
    args.selectedActivity?.name ?? args.initial.activityName ?? "";
  return {
    ...buildItemSaveCommon(args),
    parent: { kind: "activity", id: args.activityId },
    productId: null,
    productName: activityName,
    activityId: args.activityId,
    activityName,
    stageNames: [],
  };
}

export function buildProductItemSave(
  args: ItemSaveCommonArgs & {
    readonly product: { id: string; name: string };
    readonly effectiveStageNames: readonly string[];
  },
): KanbanItem {
  return {
    ...buildItemSaveCommon(args),
    parent: { kind: "product", id: args.product.id },
    productId: args.product.id,
    productName: args.product.name,
    activityId: null,
    stageNames: canonicalStageNames(args.effectiveStageNames),
  };
}
