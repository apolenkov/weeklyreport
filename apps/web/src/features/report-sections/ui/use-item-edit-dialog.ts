import type { KanbanItem, Product, RiskEntry } from "../model/types";
import { deriveItemEditFields } from "./item-edit-dialog-derive";
import type { ParentActivityOption } from "./product-picker";
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

/**
 * Composes the item dialog's form state (`use-item-edit-form-state`), pure
 * field derivation (`item-edit-dialog-derive`), and save/keydown handlers
 * (`use-item-edit-save`) into the single shape `ItemEditDialogContent` renders.
 * Kept out of the component so the dialog file stays render-only.
 */
export function useItemEditDialog({
  item,
  products,
  activities,
  week,
  currentUserName,
  defaultProductId,
  defaultActivityId,
  stagesForProduct,
  ownPeriodRanks,
  risks,
  onSave,
  onCancel,
}: UseItemEditDialogArgs) {
  const formState = useItemEditFormState({
    item,
    products,
    activities,
    week,
    currentUserName,
    defaultProductId,
    defaultActivityId,
    onCancel,
  });

  const derived = deriveItemEditFields({
    isCreate: formState.isCreate,
    item,
    initial: formState.initial,
    parent: formState.parent,
    products,
    activities,
    stageIds: formState.stageIds,
    stagesForProduct,
    ownPeriodRanks,
    status: formState.status,
    risks,
  });

  const { setParentAndStages, handleSave, handleKeyDown } = useItemEditSave({
    item,
    initial: formState.initial,
    products,
    currentUserName,
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
    onSave,
  });

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
    onParentChange: setParentAndStages,
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
    handleSave,
    handleKeyDown,
  };
}
