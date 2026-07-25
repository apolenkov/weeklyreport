import type { KanbanItem, Product, RiskEntry } from "../model/types";
import { deriveItemEditFields } from "./item-edit-dialog-derive";
import type { ParentActivityOption } from "./parent-picker";
import { useItemEditFormState } from "./use-item-edit-form-state";
import { useItemEditSave } from "./use-item-edit-save";

interface UseItemEditDialogArgs {
  readonly item: KanbanItem | null;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly week: "current" | "next";
  readonly currentUserName?: string;
  readonly defaultProductId?: string;
  readonly defaultActivityId?: string;
  readonly stagesForProduct?: (productId: string) => readonly string[];
  readonly ownPeriodRanks?: readonly number[];
  readonly risks?: readonly RiskEntry[];
  readonly onSave: (next: KanbanItem) => void;
  readonly onCancel: () => void;
}

type ItemEditFormState = ReturnType<typeof useItemEditFormState>;
type ItemEditDerived = ReturnType<typeof deriveItemEditFields>;
type ItemEditSave = ReturnType<typeof useItemEditSave>;

// The dialog's whole surface. Every editable field clears its own validation
// error on change, so a corrected field stops complaining before save.
function buildItemEditHandle(
  formState: ItemEditFormState,
  derived: ItemEditDerived,
  save: ItemEditSave,
) {
  return {
    dialogSurfaceRef: formState.dialogSurfaceRef,
    headerVerb: derived.headerVerb,
    parentName: derived.parentName,
    text: formState.text,
    onTextChange: (v: string) => {
      formState.setText(v);
      formState.setErrors((prev) => ({ ...prev, text: undefined }));
    },
    textError: formState.errors.text,
    priorityRank: formState.priorityRank,
    onPriorityRankChange: formState.setPriorityRank,
    rankOptions: derived.rankOptions,
    takenRanks: derived.takenRanks,
    parent: formState.parent,
    onParentChange: save.setParentAndStages,
    isActivityParent: derived.isActivityParent,
    stageIds: formState.stageIds,
    availableStages: derived.availableStages,
    isDeadEnd: derived.isDeadEnd,
    stageError: formState.errors.stageIds,
    onStageChange: (nextStages: string[]) => {
      formState.setStageIds(nextStages);
      formState.setErrors((prev) => ({ ...prev, stageIds: undefined }));
    },
    statusSlot: derived.statusSlot,
    status: formState.status,
    onStatusSelect: formState.setStatus,
    pausedReason: formState.pausedReason,
    pausedReasonError: formState.errors.pausedReason,
    onPausedReasonChange: (next: string) => {
      formState.setPausedReason(next);
      formState.setErrors((prev) => ({ ...prev, pausedReason: undefined }));
    },
    handleSave: save.handleSave,
    handleKeyDown: save.handleKeyDown,
  };
}

/**
 * Use Item Edit Dialog.
 * @param args - The args argument.
 */
export function useItemEditDialog(args: UseItemEditDialogArgs) {
  const formState = useItemEditFormState({
    item: args.item,
    products: args.products,
    activities: args.activities,
    week: args.week,
    currentUserName: args.currentUserName,
    defaultProductId: args.defaultProductId,
    defaultActivityId: args.defaultActivityId,
    onCancel: args.onCancel,
  });

  const derived = deriveItemEditFields({
    isCreate: formState.isCreate,
    item: args.item,
    initial: formState.initial,
    parent: formState.parent,
    products: args.products,
    activities: args.activities,
    stageIds: formState.stageIds,
    stagesForProduct: args.stagesForProduct,
    ownPeriodRanks: args.ownPeriodRanks,
    status: formState.status,
    risks: args.risks,
  });

  const save = useItemEditSave({
    item: args.item,
    initial: formState.initial,
    products: args.products,
    currentUserName: args.currentUserName,
    dialogSurfaceRef: formState.dialogSurfaceRef,
    text: formState.text,
    status: formState.status,
    pausedReason: formState.pausedReason,
    priorityRank: formState.priorityRank,
    parent: formState.parent,
    selectedActivity: derived.selectedActivity,
    isActivityParent: derived.isActivityParent,
    isDeadEnd: derived.isDeadEnd,
    availableStages: derived.availableStages,
    effectiveStageIds: derived.effectiveStageIds,
    setParent: formState.setParent,
    setStageIds: formState.setStageIds,
    setErrors: formState.setErrors,
    onSave: args.onSave,
  });

  return buildItemEditHandle(formState, derived, save);
}
