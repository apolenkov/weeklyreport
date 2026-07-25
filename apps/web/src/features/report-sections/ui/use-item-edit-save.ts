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

export function useItemEditSave(args: UseItemEditSaveArgs) {
  function setParentAndStages(nextParent: RecordParent) {
    args.setParent(nextParent);
    // Clear stages on parent switch — never default to all owned stages.
    args.setStageIds([]);
  }

  function handleSave() {
    // Dead-end: never save empty stageIds or show the unsatisfiable stage error.
    if (args.isDeadEnd) return;
    const trimmed = args.text.trim();
    const trimmedPausedReason = args.pausedReason.trim();
    const next: ItemEditErrors = collectItemErrors({
      trimmed,
      isActivityParent: args.isActivityParent,
      availableStages: args.availableStages,
      effectiveStageIds: args.effectiveStageIds,
    });
    if (args.status === "paused" && trimmedPausedReason.length === 0) {
      next.pausedReason = "A reason is required to pause an item.";
    }
    if (Object.keys(next).length > 0) {
      args.setErrors(next);
      // Focus first invalid control so errors are discoverable by keyboard/AT.
      firstInvalidControl(next, args.dialogSurfaceRef.current)?.focus();
      return;
    }
    const common = {
      item: args.item,
      trimmed,
      status: args.status,
      currentUserName: args.currentUserName,
      priorityRank: args.priorityRank,
      trimmedPausedReason,
    };
    // Activity parent → empty productId, no stage.
    if (args.isActivityParent) {
      args.onSave(
        buildActivityItemSave({
          ...common,
          selectedActivity: args.selectedActivity,
          initial: args.initial,
          activityId: args.parent.id,
        }),
      );
      return;
    }
    const product = resolveSaveProduct(
      args.products,
      args.item,
      args.parent.id,
    );
    if (!product) {
      args.setErrors({ text: "No product available" });
      return;
    }
    args.onSave(
      buildProductItemSave({
        ...common,
        product,
        effectiveStageIds: args.effectiveStageIds,
      }),
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  return { setParentAndStages, handleSave, handleKeyDown };
}
