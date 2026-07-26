import type { UseEditableListDialogResult } from "../../../hooks/use-editable-list-dialog";
import type { usePauseReason } from "../../../hooks/use-pause-reason";
import type { KanbanItem } from "../../report-sections";
import type { CurrentWeekSectionProps } from "./current-week-section.types";

export type CurrentWeekDialog = UseEditableListDialogResult<KanbanItem>;
export type PauseReasonPrompt = ReturnType<typeof usePauseReason<KanbanItem>>;

export interface CurrentWeekItemHandlers {
  readonly handleEdit: (id: string) => void;
  readonly handleDelete: (id: string) => void;
  readonly confirmDelete: () => void;
  readonly handleDialogSave: (next: KanbanItem) => void;
  readonly handleDialogCancel: () => void;
}

// Every handler emits a fresh array; the parent merges it into draftSection by
// id, so the section itself never mutates the list it was handed.
export function createItemHandlers({
  props,
  dialog,
}: {
  readonly props: CurrentWeekSectionProps;
  readonly dialog: CurrentWeekDialog;
}): CurrentWeekItemHandlers {
  const { items, readOnly = false, onItemsChange } = props;

  function handleDialogSave(next: KanbanItem) {
    if (readOnly) return;
    const isCreate =
      dialog.dialogState.open && dialog.dialogState.mode === "create";
    onItemsChange?.(
      isCreate
        ? [...items, next]
        : items.map((item) => (item.id === next.id ? next : item)),
    );
    dialog.close();
  }

  return {
    handleEdit: (id) => {
      const item = items.find((candidate) => candidate.id === id);
      if (item) dialog.openEdit(item);
    },
    handleDelete: (id) => {
      const item = items.find((candidate) => candidate.id === id);
      if (item) dialog.requestDelete(item);
    },
    confirmDelete: () => {
      const target = dialog.pendingDelete;
      if (!target) return;
      onItemsChange?.(items.filter((item) => item.id !== target.id));
      dialog.clearPendingDelete();
    },
    handleDialogSave,
    handleDialogCancel: dialog.close,
  };
}

// Flatten section state into the dialog stack's prop list. At most one of the
// edit entity / create seed applies; a closed dialog carries neither.
export function buildDialogsProps({
  props,
  dialog,
  handlers,
  pause,
}: {
  readonly props: CurrentWeekSectionProps;
  readonly dialog: CurrentWeekDialog;
  readonly handlers: CurrentWeekItemHandlers;
  readonly pause: PauseReasonPrompt;
}) {
  const { dialogState } = dialog;
  const isEdit = dialogState.open && dialogState.mode === "edit";
  const isCreate = dialogState.open && dialogState.mode === "create";

  return {
    dialogKey: dialog.dialogKey,
    open: dialogState.open,
    editItem: isEdit ? dialogState.entity : null,
    products: props.products ?? [],
    activities: props.activities,
    currentUserName: props.currentUserName,
    createSeedProductId: isCreate ? dialogState.seedProductId : undefined,
    createSeedActivityId: isCreate ? dialogState.seedActivityId : undefined,
    stagesForProduct: props.stagesForProduct,
    ownPeriodRanks: props.ownPeriodRanks,
    risks: props.risks,
    onSave: handlers.handleDialogSave,
    onCancel: handlers.handleDialogCancel,
    pendingDelete: dialog.pendingDelete,
    onConfirmDelete: handlers.confirmDelete,
    onCancelDelete: dialog.clearPendingDelete,
    pausePending: pause.pending,
    onConfirmPause: pause.confirm,
    onCancelPause: pause.cancel,
  };
}
