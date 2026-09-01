import type { UseEditableListDialogResult } from "./editable-list-dialog.types";

export interface EditableListHandlerProps<T extends { readonly id: string }> {
  readonly items: readonly T[];
  readonly readOnly?: boolean | undefined;
  readonly onItemsChange?: ((items: readonly T[]) => void) | undefined;
}

export interface EditableListHandlers<T extends { readonly id: string }> {
  readonly handleEdit: (id: string) => void;
  readonly handleDelete: (id: string) => void;
  readonly confirmDelete: () => void;
  readonly handleDialogSave: (next: T) => void;
  readonly handleDialogCancel: () => void;
}

export function createEditableListHandlers<T extends { readonly id: string }>(
  props: EditableListHandlerProps<T>,
  dialog: UseEditableListDialogResult<T>,
): EditableListHandlers<T> {
  const { items, readOnly = false, onItemsChange } = props;

  function handleDialogSave(next: T): void {
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
    handleEdit: (id: string): void => {
      const item = items.find((candidate) => candidate.id === id);
      if (item) dialog.openEdit(item);
    },
    handleDelete: (id: string): void => {
      const item = items.find((candidate) => candidate.id === id);
      if (item) dialog.requestDelete(item);
    },
    confirmDelete: (): void => {
      // Re-check the lock at confirm time: publication while the dialog is
      // open must not let the delete through.
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
