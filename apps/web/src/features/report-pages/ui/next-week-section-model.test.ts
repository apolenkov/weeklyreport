import { describe, expect, it, vi } from "vitest";

import type { UseEditableListDialogResult } from "../../../shared/hooks/dialogs/use-editable-list-dialog";
import type { KanbanItem } from "../../report-sections";
import {
  createItemHandlers,
  type NextWeekDialog,
} from "./next-week-section-model";

function makeItem(id: string): KanbanItem {
  return {
    id,
    parent: { kind: "product", id: "p1" },
    productId: "p1",
    productName: "Product 1",
    activityId: null,
    status: "planned",
    text: `Item ${id}`,
    author: "Lead 1",
    stageNames: ["Development"],
  };
}

function dialogWithPendingDelete(target: KanbanItem | null): NextWeekDialog {
  return {
    dialogState: { open: false },
    dialogKey: "k",
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    close: vi.fn(),
    pendingDelete: target,
    requestDelete: vi.fn(),
    clearPendingDelete: vi.fn(),
  } as unknown as UseEditableListDialogResult<KanbanItem>;
}

describe("createItemHandlers — section lock re-check on delete confirm", () => {
  it("blocks confirmDelete once the section is read-only", () => {
    const items = [makeItem("i-1")];
    const onItemsChange = vi.fn();
    const dialog = dialogWithPendingDelete(items[0] ?? null);

    const handlers = createItemHandlers({
      props: { items, readOnly: true, onItemsChange },
      dialog,
    });

    handlers.confirmDelete();
    expect(onItemsChange).not.toHaveBeenCalled();
    expect(dialog.clearPendingDelete).not.toHaveBeenCalled();
  });

  it("applies the delete when the section is still editable", () => {
    const items = [makeItem("i-1"), makeItem("i-2")];
    const onItemsChange = vi.fn();
    const dialog = dialogWithPendingDelete(items[0] ?? null);

    const handlers = createItemHandlers({
      props: { items, readOnly: false, onItemsChange },
      dialog,
    });

    handlers.confirmDelete();
    expect(onItemsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: "i-2" }),
    ]);
    expect(dialog.clearPendingDelete).toHaveBeenCalled();
  });
});
