import type { Dispatch, RefObject, SetStateAction } from "react";

import type { ItemStatus, KanbanItem, Product } from "../model/types";
import {
  buildActivityItemSave,
  buildProductItemSave,
  collectItemErrors,
  firstInvalidControl,
  resolveSaveProduct,
} from "./item-edit-dialog-helpers";
import type { ParentActivityOption, RecordParent } from "./parent-picker";
import type { ItemEditErrors } from "./use-item-edit-form-state";

interface UseItemEditSaveArgs {
  readonly item: KanbanItem | null;
  readonly initial: KanbanItem;
  readonly products: readonly Product[];
  readonly currentUserName?: string;
  readonly dialogSurfaceRef: RefObject<HTMLDivElement | null>;
  readonly text: string;
  readonly status: ItemStatus;
  readonly pausedReason: string;
  readonly priorityRank: number | null;
  readonly parent: RecordParent;
  readonly selectedActivity: ParentActivityOption | undefined;
  readonly isActivityParent: boolean;
  readonly isDeadEnd: boolean;
  readonly availableStages: readonly string[];
  readonly effectiveStageIds: readonly string[];
  readonly setParent: Dispatch<SetStateAction<RecordParent>>;
  readonly setStageIds: Dispatch<SetStateAction<string[]>>;
  readonly setErrors: Dispatch<SetStateAction<ItemEditErrors>>;
  readonly onSave: (next: KanbanItem) => void;
}

interface TrimmedSaveText {
  readonly trimmed: string;
  readonly trimmedPausedReason: string;
}

function collectSaveErrors(
  args: UseItemEditSaveArgs,
  text: TrimmedSaveText,
): ItemEditErrors {
  const errors = collectItemErrors({
    trimmed: text.trimmed,
    isActivityParent: args.isActivityParent,
    availableStages: args.availableStages,
    effectiveStageIds: args.effectiveStageIds,
  });
  return args.status === "paused" && text.trimmedPausedReason.length === 0
    ? { ...errors, pausedReason: "A reason is required to pause an item." }
    : errors;
}

// `null` when no product can be resolved for a product-parented item; the caller
// reports that as a field error rather than saving.
function buildSavePayload(
  args: UseItemEditSaveArgs,
  text: TrimmedSaveText,
): KanbanItem | null {
  const common = {
    item: args.item,
    trimmed: text.trimmed,
    status: args.status,
    currentUserName: args.currentUserName,
    priorityRank: args.priorityRank,
    trimmedPausedReason: text.trimmedPausedReason,
  };
  // Activity parent → empty productId, no stage.
  if (args.isActivityParent) {
    return buildActivityItemSave({
      ...common,
      selectedActivity: args.selectedActivity,
      initial: args.initial,
      activityId: args.parent.id,
    });
  }
  const product = resolveSaveProduct(args.products, args.item, args.parent.id);
  return product
    ? buildProductItemSave({
        ...common,
        product,
        effectiveStageIds: args.effectiveStageIds,
      })
    : null;
}

export function useItemEditSave(args: UseItemEditSaveArgs) {
  function setParentAndStages(nextParent: RecordParent) {
    args.setParent(nextParent);
    // Clear stages on parent switch — never default to all owned stages.
    args.setStageIds([]);
  }

  function handleSave() {
    // Dead-end: never save empty stageIds or show the unsatisfiable stage error.
    if (args.isDeadEnd) return;
    const text: TrimmedSaveText = {
      trimmed: args.text.trim(),
      trimmedPausedReason: args.pausedReason.trim(),
    };
    const errors = collectSaveErrors(args, text);
    if (Object.keys(errors).length > 0) {
      args.setErrors(errors);
      // Focus first invalid control so errors are discoverable by keyboard/AT.
      firstInvalidControl(errors, args.dialogSurfaceRef.current)?.focus();
      return;
    }
    const payload = buildSavePayload(args, text);
    if (!payload) {
      args.setErrors({ text: "No product available" });
      return;
    }
    args.onSave(payload);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  return { setParentAndStages, handleSave, handleKeyDown };
}
