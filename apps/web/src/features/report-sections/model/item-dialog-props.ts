import type { EditableListHandlers } from "../../../shared/hooks/dialogs/create-editable-list-handlers";
import type { UseEditableListDialogResult } from "../../../shared/hooks/dialogs/editable-list-dialog.types";
import type { KanbanItem, Product, RiskEntry } from "./types";

export interface ItemDialogSectionData {
  readonly products?: readonly Product[] | undefined;
  readonly activities?: readonly { id: string; name: string }[] | undefined;
  readonly currentUserName?: string | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  readonly ownPeriodRanks?: readonly number[] | undefined;
  readonly risks?: readonly RiskEntry[] | undefined;
}

export function buildItemDialogProps({
  section,
  dialog,
  handlers,
  week,
}: {
  readonly section: ItemDialogSectionData;
  readonly dialog: UseEditableListDialogResult<KanbanItem>;
  readonly handlers: EditableListHandlers<KanbanItem>;
  readonly week: "current" | "next";
}) {
  const { dialogState } = dialog;
  const isEdit = dialogState.open && dialogState.mode === "edit";
  const isCreate = dialogState.open && dialogState.mode === "create";

  return {
    dialogKey: dialog.dialogKey,
    open: dialogState.open,
    editItem: isEdit ? dialogState.entity : null,
    products: section.products ?? [],
    activities: section.activities,
    week,
    currentUserName: section.currentUserName,
    createSeedProductId: isCreate ? dialogState.seedProductId : undefined,
    createSeedActivityId: isCreate ? dialogState.seedActivityId : undefined,
    stagesForProduct: section.stagesForProduct,
    ownPeriodRanks: section.ownPeriodRanks,
    risks: section.risks,
    onSave: handlers.handleDialogSave,
    onCancel: handlers.handleDialogCancel,
    pendingDelete: dialog.pendingDelete,
    onConfirmDelete: handlers.confirmDelete,
    onCancelDelete: dialog.clearPendingDelete,
  };
}
