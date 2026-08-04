import type { UseEditableListDialogResult } from "../../../hooks/use-editable-list-dialog";
import type { KanbanItem, Product, RiskEntry } from "../../report-sections";

export interface NextWeekSectionProps {
  readonly items: readonly KanbanItem[];
  // Own risks for ItemCard alarm derivation (in-progress only; planned never floors).
  readonly risks?: readonly RiskEntry[] | undefined;
  readonly readOnly?: boolean | undefined;
  // Parent merges into draftSection.items by id, preserving non-presentation fields.
  readonly onItemsChange?: ((items: readonly KanbanItem[]) => void) | undefined;
  readonly currentUserName?: string | undefined;
  readonly products?: readonly Product[] | undefined;
  readonly activities?: readonly { id: string; name: string }[] | undefined;
  readonly stagesForProduct?:
    ((productId: string) => readonly string[]) | undefined;
  // Full-period ranks so ItemEditDialog can disable taken priority ranks.
  readonly ownPeriodRanks?: readonly number[] | undefined;
  readonly addSignal?: number | undefined;
  // Resolve-not-delete (ADR 0015): published-lineage ids show marker, hide Delete.
  readonly publishedLockedIds?: ReadonlySet<string> | undefined;
  readonly onMoveToCurrentWeek?: ((id: string) => void) | undefined;
}

export type NextWeekDialog = UseEditableListDialogResult<KanbanItem>;

export interface NextWeekItemHandlers {
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
  readonly props: NextWeekSectionProps;
  readonly dialog: NextWeekDialog;
}): NextWeekItemHandlers {
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
      // Re-check the lock at confirm time — a period published while the
      // dialog is open must not let the delete through.
      if (readOnly) return;
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
// three applies: edit binds an entity, create carries the lane/column seed it
// was opened from, closed carries neither.
export function buildDialogsProps({
  props,
  dialog,
  handlers,
}: {
  readonly props: NextWeekSectionProps;
  readonly dialog: NextWeekDialog;
  readonly handlers: NextWeekItemHandlers;
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
  };
}
