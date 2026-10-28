import type { Dispatch, RefObject, SetStateAction } from "react";

import type {
  ParentActivityOption,
  RecordParent,
} from "../model/record-parent";
import type { ItemStatus, KanbanItem, Product } from "../model/types";
import {
  buildActivityItemSave,
  buildProductItemSave,
  collectItemErrors,
  collectItemStatusErrors,
  firstInvalidControl,
  resolveSaveProduct,
} from "./item-edit-dialog-helpers";
import type { ItemEditErrors } from "./use-item-edit-form-state";

interface UseItemEditSaveArgs {
  readonly item: KanbanItem | null;
  readonly initial: KanbanItem;
  readonly products: readonly Product[];
  readonly currentUserName?: string | undefined;
  readonly dialogSurfaceRef: RefObject<HTMLDivElement | null>;
  readonly text: string;
  readonly nextStepText: string;
  readonly status: ItemStatus;
  readonly pausedReason: string;
  readonly priorityRank: number | null;
  readonly parent: RecordParent;
  readonly selectedActivity: ParentActivityOption | undefined;
  readonly isActivityParent: boolean;
  readonly isDeadEnd: boolean;
  readonly availableStages: readonly string[];
  readonly effectiveStageNames: readonly string[];
  readonly setParent: Dispatch<SetStateAction<RecordParent>>;
  readonly setStageNames: Dispatch<SetStateAction<string[]>>;
  readonly setErrors: Dispatch<SetStateAction<ItemEditErrors>>;
  readonly onSave: (next: KanbanItem) => void;
  readonly onSaveAndAddAnother?: ((next: KanbanItem) => void) | undefined;
}

interface TrimmedSaveText {
  readonly trimmed: string;
  readonly trimmedNextStepText: string;
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
    effectiveStageNames: args.effectiveStageNames,
  });
  return {
    ...errors,
    ...collectItemStatusErrors({
      status: args.status,
      trimmedNextStepText: text.trimmedNextStepText,
      trimmedPausedReason: text.trimmedPausedReason,
    }),
  };
}

// `null` when no product can be resolved for a product-parented item; the caller
// reports that as a field error rather than saving.
function buildSavePayload(
  args: UseItemEditSaveArgs,
  text: TrimmedSaveText,
): KanbanItem | null {
  const common = {
    item: args.item,
    stableId: args.initial.stableId,
    tag: args.initial.tag,
    trimmed: text.trimmed,
    status: args.status,
    currentUserName: args.currentUserName,
    priorityRank: args.priorityRank,
    trimmedNextStepText: text.trimmedNextStepText,
    trimmedPausedReason: text.trimmedPausedReason,
  };
  if (args.parent.kind === "activity") {
    return buildActivityItemSave({
      ...common,
      selectedActivity: args.selectedActivity,
      initial: args.initial,
      activityId: args.parent.id,
    });
  }
  if (args.parent.kind === "unresolved") return null;
  const product = resolveSaveProduct(args.products, args.item, args.parent.id);
  return product
    ? buildProductItemSave({
        ...common,
        product,
        effectiveStageNames: args.effectiveStageNames,
      })
    : null;
}

export function useItemEditSave(args: UseItemEditSaveArgs) {
  function setParentAndStages(nextParent: RecordParent) {
    args.setParent(nextParent);
    // Clear stages on parent switch — never default to all owned stages.
    args.setStageNames([]);
    args.setErrors((previous) => ({
      ...previous,
      parent: undefined,
      stageNames: undefined,
    }));
  }

  function executeSave(deliver: (next: KanbanItem) => void) {
    // Dead-end: never save empty stageNames or show the unsatisfiable stage error.
    if (args.isDeadEnd) return;
    const text: TrimmedSaveText = {
      trimmed: args.text.trim(),
      trimmedNextStepText: args.nextStepText.trim(),
      trimmedPausedReason: args.pausedReason.trim(),
    };
    const errors = collectSaveErrors(args, text);
    if (Object.keys(errors).length > 0) {
      args.setErrors(errors);
      // Focus first invalid control so errors are discoverable by keyboard/AT.
      const invalidControl = firstInvalidControl(
        errors,
        args.dialogSurfaceRef.current,
      );
      if (invalidControl) invalidControl.focus();
      else {
        queueMicrotask(() => {
          firstInvalidControl(errors, args.dialogSurfaceRef.current)?.focus();
        });
      }
      return;
    }
    const payload = buildSavePayload(args, text);
    if (!payload) {
      const errors = { parent: "No product available" };
      args.setErrors(errors);
      const invalidControl = firstInvalidControl(
        errors,
        args.dialogSurfaceRef.current,
      );
      if (invalidControl) invalidControl.focus();
      else {
        queueMicrotask(() => {
          firstInvalidControl(errors, args.dialogSurfaceRef.current)?.focus();
        });
      }
      return;
    }
    deliver(payload);
  }

  function handleSave() {
    executeSave(args.onSave);
  }

  const onSaveAndAddAnother = args.onSaveAndAddAnother;
  const handleSaveAndAddAnother = onSaveAndAddAnother
    ? () => executeSave(onSaveAndAddAnother)
    : undefined;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (e.shiftKey && handleSaveAndAddAnother) {
        handleSaveAndAddAnother();
      } else {
        handleSave();
      }
    }
  }

  return {
    setParentAndStages,
    handleSave,
    handleSaveAndAddAnother,
    handleKeyDown,
  };
}
