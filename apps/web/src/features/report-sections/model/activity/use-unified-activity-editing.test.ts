import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import type { KanbanItem } from "../types";
import type { UnifiedActivityEntry } from "./unified-activity-entry";
import { useUnifiedActivityEditing } from "./use-unified-activity-editing";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makeItem(id: string, stableId?: string): KanbanItem {
  return {
    id,
    stableId,
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

describe("useUnifiedActivityEditing — live target resolution", () => {
  function mountEditing(entries: readonly UnifiedActivityEntry[]) {
    const onWeekItemsChange = vi.fn();
    const rendered = renderHook(
      ({ rows }: { readonly rows: readonly UnifiedActivityEntry[] }) =>
        useUnifiedActivityEditing({
          entries: rows,
          readOnly: false,
          onWeekItemsChange,
        }),
      { initialProps: { rows: entries } },
    );
    return { ...rendered, onWeekItemsChange };
  }

  it("saves onto the reminted physical id matched by stable lineage", () => {
    // A save response remints the physical id; the stable lineage identifies
    // the same record in the latest entries.
    const captured: UnifiedActivityEntry = {
      item: makeItem("i-old", "stable-1"),
      bucket: "in-progress",
      week: "current",
    };
    const reminted: UnifiedActivityEntry = {
      item: makeItem("i-new", "stable-1"),
      bucket: "in-progress",
      week: "current",
    };
    const { result, rerender, onWeekItemsChange } = mountEditing([captured]);

    act(() => result.current.requestEdit(captured));
    rerender({ rows: [reminted] });
    act(() => result.current.saveEdited({ ...captured.item, text: "edited" }));

    expect(onWeekItemsChange).toHaveBeenCalledExactlyOnceWith("current", [
      { ...reminted.item, text: "edited" },
    ]);
    expect(result.current.editState).toBeNull();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("keeps the editor open and emits no write when the captured row is gone", () => {
    const captured: UnifiedActivityEntry = {
      item: makeItem("i-old", "stable-1"),
      bucket: "in-progress",
      week: "current",
    };
    const { result, rerender, onWeekItemsChange } = mountEditing([captured]);

    act(() => result.current.requestEdit(captured));
    rerender({ rows: [] });
    act(() => result.current.saveEdited({ ...captured.item, text: "edited" }));

    expect(onWeekItemsChange).not.toHaveBeenCalled();
    expect(result.current.editState).not.toBeNull();
    expect(toast.error).toHaveBeenCalledOnce();
  });

  it("keeps the editor open when a reminted row left no resolvable lineage", () => {
    // A pre-first-save temporary row has no stableId; nothing may guess the
    // mapping from text or position.
    const captured: UnifiedActivityEntry = {
      item: makeItem("temp-1"),
      bucket: "in-progress",
      week: "current",
    };
    const other: UnifiedActivityEntry = {
      item: makeItem("i-9"),
      bucket: "in-progress",
      week: "current",
    };
    const { result, rerender, onWeekItemsChange } = mountEditing([captured]);

    act(() => result.current.requestEdit(captured));
    rerender({ rows: [other] });
    act(() => result.current.saveEdited({ ...captured.item, text: "edited" }));

    expect(onWeekItemsChange).not.toHaveBeenCalled();
    expect(result.current.editState).not.toBeNull();
  });

  it("keeps the editor open when the lineage match is ambiguous", () => {
    const captured: UnifiedActivityEntry = {
      item: makeItem("i-old", "stable-1"),
      bucket: "in-progress",
      week: "current",
    };
    const rows: UnifiedActivityEntry[] = [
      {
        item: makeItem("i-new-a", "stable-1"),
        bucket: "in-progress",
        week: "current",
      },
      {
        item: makeItem("i-new-b", "stable-1"),
        bucket: "in-progress",
        week: "current",
      },
    ];
    const { result, rerender, onWeekItemsChange } = mountEditing([captured]);

    act(() => result.current.requestEdit(captured));
    rerender({ rows });
    act(() => result.current.saveEdited({ ...captured.item, text: "edited" }));

    expect(onWeekItemsChange).not.toHaveBeenCalled();
    expect(result.current.editState).not.toBeNull();
  });

  it("does not follow a row that moved to the other week", () => {
    const captured: UnifiedActivityEntry = {
      item: makeItem("i-1", "stable-1"),
      bucket: "in-progress",
      week: "current",
    };
    const moved: UnifiedActivityEntry = {
      item: makeItem("i-1", "stable-1"),
      bucket: "deferred",
      week: "next",
    };
    const { result, rerender, onWeekItemsChange } = mountEditing([captured]);

    act(() => result.current.requestEdit(captured));
    rerender({ rows: [moved] });
    act(() => result.current.saveEdited({ ...captured.item, text: "edited" }));

    expect(onWeekItemsChange).not.toHaveBeenCalled();
    expect(result.current.editState).not.toBeNull();
  });

  it("keeps the delete confirmation open and emits no write when the row disappeared", () => {
    const captured: UnifiedActivityEntry = {
      item: makeItem("i-1", "stable-1"),
      bucket: "in-progress",
      week: "current",
    };
    const { result, rerender, onWeekItemsChange } = mountEditing([captured]);

    act(() => result.current.requestDelete(captured));
    rerender({ rows: [] });
    act(() => result.current.confirmDelete());

    expect(onWeekItemsChange).not.toHaveBeenCalled();
    expect(result.current.pendingDelete).not.toBeNull();
    expect(toast.error).toHaveBeenCalledOnce();
  });

  it("deletes the reminted row matched by stable lineage", () => {
    const captured: UnifiedActivityEntry = {
      item: makeItem("i-old", "stable-1"),
      bucket: "in-progress",
      week: "current",
    };
    const reminted: UnifiedActivityEntry = {
      item: makeItem("i-new", "stable-1"),
      bucket: "in-progress",
      week: "current",
    };
    const { result, rerender, onWeekItemsChange } = mountEditing([captured]);

    act(() => result.current.requestDelete(captured));
    rerender({ rows: [reminted] });
    act(() => result.current.confirmDelete());

    expect(onWeekItemsChange).toHaveBeenCalledExactlyOnceWith("current", []);
    expect(result.current.pendingDelete).toBeNull();
  });

  it("applies an ordinary save and delete on an unchanged row", () => {
    const { result, onWeekItemsChange } = mountEditing([entry]);

    act(() => result.current.requestEdit(entry));
    act(() => result.current.saveEdited({ ...entry.item, text: "edited" }));
    expect(onWeekItemsChange).toHaveBeenLastCalledWith("current", [
      { ...entry.item, text: "edited" },
    ]);

    act(() => result.current.requestDelete(entry));
    act(() => result.current.confirmDelete());
    expect(onWeekItemsChange).toHaveBeenLastCalledWith("current", []);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
