import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useEditableListDialog } from "./use-editable-list-dialog";

interface TestEntity {
  id: string;
  label: string;
}

const entityA: TestEntity = { id: "a", label: "Alpha" };
const entityB: TestEntity = { id: "b", label: "Bravo" };

describe("useEditableListDialog", () => {
  it("opens create mode when the add signal advances from idle", () => {
    const { result, rerender } = renderHook(
      ({ addSignal }) =>
        useEditableListDialog<TestEntity>({
          readOnly: false,
          addSignal,
          seedProductId: "crm",
        }),
      { initialProps: { addSignal: 0 } },
    );

    expect(result.current.dialogState.open).toBe(false);

    rerender({ addSignal: 1 });

    expect(result.current.dialogState).toEqual({
      open: true,
      mode: "create",
      seedProductId: "crm",
    });
  });

  it("does NOT reopen when readOnly toggles false→true→false with a stale signal (D1)", () => {
    const { result, rerender } = renderHook(
      ({ readOnly, addSignal }) =>
        useEditableListDialog<TestEntity>({ readOnly, addSignal }),
      { initialProps: { readOnly: false, addSignal: 0 } },
    );

    // Counter starts idle (parent's initial state); the "+ Add" click advances
    // it 0→1 → create open. (Mounting straight at 1 is a remount, never a first
    // mount.)
    rerender({ readOnly: false, addSignal: 1 });
    expect(result.current.dialogState.open).toBe(true);

    // User cancels; signal counter is not reset by the (external) owner.
    act(() => result.current.close());
    expect(result.current.dialogState.open).toBe(false);

    // Enter snapshot (readOnly true), then return to live (readOnly false)
    // with the SAME stale signal — must not reopen.
    rerender({ readOnly: true, addSignal: 1 });
    expect(result.current.dialogState.open).toBe(false);
    rerender({ readOnly: false, addSignal: 1 });
    expect(result.current.dialogState.open).toBe(false);

    // Only a genuinely new increment reopens.
    rerender({ readOnly: false, addSignal: 2 });
    expect(result.current.dialogState.open).toBe(true);
  });

  it("does NOT reopen on remount while the parent signal stays stale on the slides toggle", () => {
    // Slides/edit remounts the section while LeadForm keeps a stale non-zero
    // addSignal; remount must not auto-open create.
    const first = renderHook(
      ({ addSignal }) =>
        useEditableListDialog<TestEntity>({ readOnly: false, addSignal }),
      { initialProps: { addSignal: 0 } },
    );
    first.rerender({ addSignal: 1 });
    expect(first.result.current.dialogState.open).toBe(true);
    act(() => first.result.current.close());
    expect(first.result.current.dialogState.open).toBe(false);

    // Enter slides mode → the section unmounts.
    first.unmount();

    // Return to edit → the section REMOUNTS carrying the SAME stale signal.
    const second = renderHook(
      ({ addSignal }) =>
        useEditableListDialog<TestEntity>({ readOnly: false, addSignal }),
      { initialProps: { addSignal: 1 } },
    );
    // Must stay closed — the mount-time seed short-circuits the stale signal.
    expect(second.result.current.dialogState.open).toBe(false);

    // A genuine new "+ Add" increment after remount still opens.
    second.rerender({ addSignal: 2 });
    expect(second.result.current.dialogState.open).toBe(true);
  });

  it("does NOT reopen when seedProductId changes while the signal is stale (D4)", () => {
    const { result, rerender } = renderHook(
      ({ seedProductId, addSignal }) =>
        useEditableListDialog<TestEntity>({
          readOnly: false,
          addSignal,
          seedProductId,
        }),
      { initialProps: { seedProductId: "crm", addSignal: 0 } },
    );

    rerender({ seedProductId: "crm", addSignal: 1 });
    expect(result.current.dialogState.open).toBe(true);
    act(() => result.current.close());
    expect(result.current.dialogState.open).toBe(false);

    // Products list changes (new seed) while the signal stays at 1 — the
    // effect re-runs because seedProductId is in its deps, but lastHandled
    // guards against reopening.
    rerender({ seedProductId: "billing", addSignal: 1 });
    expect(result.current.dialogState.open).toBe(false);
  });

  it("does not open from the signal when requireSeed is set and no seed exists", () => {
    const { result, rerender } = renderHook(
      ({ seedProductId, addSignal }) =>
        useEditableListDialog<TestEntity>({
          readOnly: false,
          addSignal,
          seedProductId,
          requireSeed: true,
        }),
      {
        initialProps: {
          seedProductId: undefined as string | undefined,
          addSignal: 1,
        },
      },
    );

    expect(result.current.dialogState.open).toBe(false);

    // Once a seed arrives with a NEW signal, it opens.
    rerender({ seedProductId: "crm", addSignal: 2 });
    expect(result.current.dialogState).toEqual({
      open: true,
      mode: "create",
      seedProductId: "crm",
    });
  });

  it("increments dialogKey monotonically across repeated opens", () => {
    const { result } = renderHook(() =>
      useEditableListDialog<TestEntity>({ readOnly: false, addSignal: 0 }),
    );

    const keys: string[] = [];
    act(() => result.current.openCreate({ productId: "crm" }));
    keys.push(result.current.dialogKey);
    act(() => result.current.openEdit(entityA));
    keys.push(result.current.dialogKey);
    act(() => result.current.openEdit(entityA));
    keys.push(result.current.dialogKey);

    // Edit-mode keys embed the entity id; the openSeq prefix always advances.
    expect(keys).toEqual(["1-new", "2-a", "3-a"]);
  });

  it("manages pendingDelete: request, then confirm or cancel", () => {
    const { result } = renderHook(() =>
      useEditableListDialog<TestEntity>({ readOnly: false, addSignal: 0 }),
    );

    expect(result.current.pendingDelete).toBeNull();

    act(() => result.current.requestDelete(entityB));
    expect(result.current.pendingDelete).toEqual(entityB);

    act(() => result.current.clearPendingDelete());
    expect(result.current.pendingDelete).toBeNull();
  });

  it("blocks open/edit/delete while readOnly", () => {
    const { result } = renderHook(() =>
      useEditableListDialog<TestEntity>({ readOnly: true, addSignal: 0 }),
    );

    act(() => result.current.openCreate({ productId: "crm" }));
    expect(result.current.dialogState.open).toBe(false);

    act(() => result.current.openEdit(entityA));
    expect(result.current.dialogState.open).toBe(false);

    act(() => result.current.requestDelete(entityB));
    expect(result.current.pendingDelete).toBeNull();
  });
});
