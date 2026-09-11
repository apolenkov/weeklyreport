import { describe, expect, it, vi } from "vitest";

import { createEditableListHandlers } from "./create-editable-list-handlers";
import type {
  CreateSeed,
  UseEditableListDialogResult,
} from "./editable-list-dialog.types";

interface Item {
  readonly id: string;
}

function createDialog(
  pendingDelete: Item | null,
): UseEditableListDialogResult<Item> {
  return {
    dialogState: { open: false },
    dialogKey: "dialog",
    openCreate: vi.fn<(seed?: CreateSeed) => void>(),
    openEdit: vi.fn<(entity: Item) => void>(),
    close: vi.fn<() => void>(),
    pendingDelete,
    requestDelete: vi.fn<(entity: Item) => void>(),
    clearPendingDelete: vi.fn<() => void>(),
  } satisfies UseEditableListDialogResult<Item>;
}

describe("createEditableListHandlers", () => {
  it("re-checks read-only state when a pending delete is confirmed", () => {
    const items = [{ id: "item-1" }];
    const onItemsChange = vi.fn();
    const dialog = createDialog(items[0] ?? null);
    const handlers = createEditableListHandlers(
      { items, readOnly: true, onItemsChange },
      dialog,
    );

    handlers.confirmDelete();

    expect(onItemsChange).not.toHaveBeenCalled();
    expect(dialog.clearPendingDelete).not.toHaveBeenCalled();
  });

  it("deletes the pending item while the list remains editable", () => {
    const items = [{ id: "item-1" }, { id: "item-2" }];
    const onItemsChange = vi.fn();
    const dialog = createDialog(items[0] ?? null);
    const handlers = createEditableListHandlers(
      { items, readOnly: false, onItemsChange },
      dialog,
    );

    handlers.confirmDelete();

    expect(onItemsChange).toHaveBeenCalledWith([{ id: "item-2" }]);
    expect(dialog.clearPendingDelete).toHaveBeenCalledOnce();
  });
});
