import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { KanbanItem } from "../types";
import {
  type UnifiedActivityEntry,
  useUnifiedActivityEditing,
} from "./use-unified-activity-editing";

function makeItem(id: string): KanbanItem {
  return {
    id,
    parent: { kind: "product", id: "p1" },
    productId: "p1",
    productName: "Product 1",
    activityId: null,
    status: "in-progress",
    text: `Item ${id}`,
    author: "Lead 1",
    stageNames: ["Development"],
  };
}

const entry: UnifiedActivityEntry = {
  item: makeItem("i-1"),
  bucket: "in-progress",
  week: "current",
};

describe("useUnifiedActivityEditing — section lock re-check", () => {
  it("blocks requestDelete once the section is read-only", () => {
    const onWeekItemsChange = vi.fn();
    const { result } = renderHook(() =>
      useUnifiedActivityEditing({
        entries: [entry],
        readOnly: true,
        onWeekItemsChange,
      }),
    );

    act(() => result.current.requestDelete(entry));
    expect(result.current.pendingDelete).toBeNull();
    expect(onWeekItemsChange).not.toHaveBeenCalled();
  });

  it("does not apply a save that reaches the handler after the lock was acquired", () => {
    const onWeekItemsChange = vi.fn();
    // First render unlocked so the edit dialog can open…
    const { result, rerender } = renderHook(
      ({ readOnly }: { readonly readOnly: boolean }) =>
        useUnifiedActivityEditing({
          entries: [entry],
          readOnly,
          onWeekItemsChange,
        }),
      { initialProps: { readOnly: false } },
    );

    act(() => result.current.requestEdit(entry));
    expect(result.current.editState).not.toBeNull();

    // …then the period locks while the dialog is open; saving must not apply.
    rerender({ readOnly: true });
    act(() => result.current.saveEdited({ ...entry.item, text: "edited" }));
    expect(onWeekItemsChange).not.toHaveBeenCalled();
  });

  it("does not apply a delete that reaches the handler after the lock was acquired", () => {
    const onWeekItemsChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ readOnly }: { readonly readOnly: boolean }) =>
        useUnifiedActivityEditing({
          entries: [entry],
          readOnly,
          onWeekItemsChange,
        }),
      { initialProps: { readOnly: false } },
    );

    act(() => result.current.requestDelete(entry));
    expect(result.current.pendingDelete).not.toBeNull();

    rerender({ readOnly: true });
    act(() => result.current.confirmDelete());
    expect(onWeekItemsChange).not.toHaveBeenCalled();
  });
});
