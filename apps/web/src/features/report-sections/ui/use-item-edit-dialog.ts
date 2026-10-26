import type { ParentActivityOption } from "../model/record-parent";
import type { KanbanItem, Product, RiskEntry } from "../model/types";
import { useDraftStageMemory } from "./draft-stage-memory-context";
import { deriveItemEditFields } from "./item-edit-dialog-derive";
import { collectItemStatusErrors } from "./item-edit-dialog-helpers";
import type { ItemEditDraftStore } from "./item-edit-draft-store";
import { useItemEditFormState } from "./use-item-edit-form-state";
import { useItemEditSave } from "./use-item-edit-save";

interface UseItemEditDialogArgs {
  readonly presentation?: "dialog" | "inline" | undefined;
  readonly draftStore?: ItemEditDraftStore | undefined;
  readonly item: KanbanItem | null;
  readonly products: readonly Product[];
  readonly activities: readonly ParentActivityOption[];
  readonly week: "current" | "next";
  readonly currentUserName?: string | undefined;
  readonly defaultProductId?: string | undefined;
  readonly defaultActivityId?: string | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly ownPeriodRanks?: readonly number[] | undefined;
  readonly risks?: readonly RiskEntry[] | undefined;
  readonly onSave: (next: KanbanItem) => void;
  readonly onCancel: () => void;
  readonly isPending?: boolean | undefined;
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
    requestClose: formState.requestClose,
    discardDialog: formState.discardDialog,
    headerVerb: derived.headerVerb,
    parentName: derived.parentName,
    text: formState.text,
    onTextChange: (v: string) => {
      formState.setText(v);
      formState.setErrors((prev) => ({ ...prev, text: undefined }));
    },
    textError: formState.errors.text,
    nextStepText: formState.nextStepText,
    nextStepTextError: formState.errors.nextStepText,
    onNextStepTextChange: (v: string) => {
      formState.setNextStepText(v);
      formState.setErrors((prev) => ({ ...prev, nextStepText: undefined }));
    },
    priorityRank: formState.priorityRank,
    onPriorityRankChange: formState.setPriorityRank,
    rankOptions: derived.rankOptions,
    takenRanks: derived.takenRanks,
    parent: formState.parent,
    parentError: formState.errors.parent,
    onParentChange: save.setParentAndStages,
    isActivityParent: derived.isActivityParent,
    stageNames: formState.stageNames,
    availableStages: derived.availableStages,
    isDeadEnd: derived.isDeadEnd,
    stageError: formState.errors.stageNames,
    onStageChange: (nextStages: string[]) => {
      formState.setStageNames(nextStages);
      formState.setErrors((prev) => ({ ...prev, stageNames: undefined }));
    },
    statusSlot: derived.statusSlot,
    status: formState.status,
    onStatusSelect: (next: typeof formState.status) => {
      formState.setStatus(next);
      const errors = collectItemStatusErrors({
        status: next,
        trimmedNextStepText: formState.nextStepText.trim(),
        trimmedPausedReason: formState.pausedReason.trim(),
      });
      formState.setErrors((previous) => ({
        ...previous,
        ...(previous.nextStepText === undefined
          ? {}
          : { nextStepText: errors.nextStepText }),
        ...(previous.pausedReason === undefined
          ? {}
          : { pausedReason: errors.pausedReason }),
      }));
    },
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

export function useItemEditDialog(args: UseItemEditDialogArgs) {
  // A record dialog reads the open draft's stage memory; outside a lead-form
  // draft there is none, so the selector keeps its empty/sole-stage defaults.
  const stageMemory = useDraftStageMemory();
  const formState = useItemEditFormState({
    item: args.item,
    products: args.products,
    activities: args.activities,
    week: args.week,
    currentUserName: args.currentUserName,
    defaultProductId: args.defaultProductId,
    defaultActivityId: args.defaultActivityId,
    onCancel: args.onCancel,
    isPending: args.isPending,
    presentation: args.presentation,
    draftStore: args.draftStore,
    stageMemory: stageMemory ?? undefined,
    stagesForProduct: args.stagesForProduct,
  });

  const derived = deriveItemEditFields({
    isCreate: formState.isCreate,
    item: args.item,
    initial: formState.initial,
    parent: formState.parent,
    products: args.products,
    activities: args.activities,
    stageNames: formState.stageNames,
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
    nextStepText: formState.nextStepText,
    status: formState.status,
    pausedReason: formState.pausedReason,
    priorityRank: formState.priorityRank,
    parent: formState.parent,
    selectedActivity: derived.selectedActivity,
    isActivityParent: derived.isActivityParent,
    isDeadEnd: derived.isDeadEnd,
    availableStages: derived.availableStages,
    effectiveStageNames: derived.effectiveStageNames,
    setParent: formState.setParent,
    setStageNames: formState.setStageNames,
    setErrors: formState.setErrors,
    onSave: args.onSave,
  });

  return buildItemEditHandle(formState, derived, save);
}
