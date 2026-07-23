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

/**
 * `setParentAndStages` (parent-switch handler) + the save/keydown handlers.
 * Split out of `useItemEditDialog` alongside the raw state
 * (`use-item-edit-form-state`) and the pure derivation
 * (`item-edit-dialog-derive`).
 */
export function useItemEditSave(args: UseItemEditSaveArgs) {
  function setParentAndStages(nextParent: RecordParent) {
    args.setParent(nextParent);
    // Clear the stage selection on any parent switch — never default to all
    // owned stages (mirrors the risk dialog). Switching to an activity hides the
    // stage step; switching back to a product re-shows it empty. The
    // single-owned-stage convenience still applies at save time.
    args.setStageIds([]);
  }

  function handleSave() {
    // Dead-end no-op: never call onSave with an empty stageIds array, and never
    // surface the unsatisfiable "Select at least one stage." error. The
    // Ctrl/Cmd+Enter shortcut routes through here, so it inherits the guard.
    if (args.isDeadEnd) return;
    const trimmed = args.text.trim();
    const trimmedPausedReason = args.pausedReason.trim();
    const next: ItemEditErrors = collectItemErrors({
      trimmed,
      isActivityParent: args.isActivityParent,
      availableStages: args.availableStages,
      effectiveStageIds: args.effectiveStageIds,
    });
    // require-paused-item-reason: a Paused item must carry a reason.
    if (args.status === "paused" && trimmedPausedReason.length === 0) {
      next.pausedReason = "A reason is required to pause an item.";
    }
    if (Object.keys(next).length > 0) {
      args.setErrors(next);
      // Move focus to the first invalid control so the error is discoverable
      // by keyboard/screen-reader users instead of leaving focus on Save.
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
    // activity-first-class: an activity parent yields an activity-parented row
    // (empty productId, no stage); a product parent keeps today's output.
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
