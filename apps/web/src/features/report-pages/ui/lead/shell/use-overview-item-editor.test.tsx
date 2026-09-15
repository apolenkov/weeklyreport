import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  StatusOverviewItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import { useOverviewItemEditor } from "./use-overview-item-editor";

describe("overview quick edit temporal target", () => {
  it.each(["read-only", "historical"])("does not write a %s row", (reason) => {
    const apply = vi.fn();
    const editor = { draft: { apply } } as unknown as NonNullable<
      Parameters<typeof useOverviewItemEditor>[0]
    >;
    const item = {
      recordId: "current-1",
      editTarget:
        reason === "historical"
          ? null
          : { recordId: "current-1", source: "current", focusNextStep: false },
    } as StatusOverviewItem;
    const { result } = renderHook(() =>
      useOverviewItemEditor(
        editor,
        reason === "read-only",
        { units: [] } as unknown as StatusOverviewModel,
        "report-1",
      ),
    );
    act(() => result.current.quickEditText(item, "Changed"));
    expect(apply).not.toHaveBeenCalled();
  });

  it.each([
    { source: "current", targetSource: "current", focusNextStep: false },
    { source: "next", targetSource: "current", focusNextStep: true },
    { source: "next", targetSource: "next", focusNextStep: false },
  ] as const)(
    "routes $source text to $targetSource (next step: $focusNextStep)",
    ({ source, targetSource, focusNextStep }) => {
      const apply = vi.fn();
      const editor = { draft: { apply } } as unknown as NonNullable<
        Parameters<typeof useOverviewItemEditor>[0]
      >;
      const model = { units: [] } as unknown as StatusOverviewModel;
      const item = {
        recordId: "current-1",
        source,
        text: focusNextStep ? "Next commitment" : "Current result",
        editTarget: {
          recordId: "current-1",
          source: targetSource,
          focusNextStep,
        },
      } as StatusOverviewItem;
      const { result } = renderHook(() =>
        useOverviewItemEditor(editor, false, model, "report-1"),
      );
      act(() => result.current.quickEditText(item, "Changed"));
      expect(apply).toHaveBeenCalledExactlyOnceWith({
        kind: "item-patch",
        itemId: "current-1",
        patch: focusNextStep
          ? { nextStepText: "Changed" }
          : { text: "Changed" },
      });
    },
  );

  it("rejects a next-period commitment on a completed record", () => {
    const apply = vi.fn();
    const editor = { draft: { apply } } as unknown as NonNullable<
      Parameters<typeof useOverviewItemEditor>[0]
    >;
    const item = {
      recordId: "current-1",
      source: "current",
      workflowStatus: "done",
      editTarget: {
        recordId: "current-1",
        source: "current",
        focusNextStep: true,
      },
    } as StatusOverviewItem;
    const { result } = renderHook(() =>
      useOverviewItemEditor(
        editor,
        false,
        { units: [] } as unknown as StatusOverviewModel,
        "report-1",
      ),
    );
    act(() => result.current.quickEditText(item, "Sneaky commitment"));
    expect(apply).not.toHaveBeenCalled();
  });
});
