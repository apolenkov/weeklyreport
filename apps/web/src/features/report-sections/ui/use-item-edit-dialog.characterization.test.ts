/**
 * Characterization tests for `useItemEditDialog`, pinning the hook's return
 * shape directly. The existing `item-edit-dialog.test.tsx` suite exercises the
 * hook only indirectly through rendered DOM; these tests catch return-shape
 * regressions without mounting the full dialog.
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { KanbanItem, Product } from "../model/types";
import type { ParentActivityOption } from "./product-picker";
import { useItemEditDialog } from "./use-item-edit-dialog";

const PRODUCT: Product = {
  id: "p1",
  name: "DevOps Tools",
  overallStatus: "on-track",
  stages: [],
};
const ZERO_STAGE_PRODUCT: Product = {
  id: "p2",
  name: "No Stages Product",
  overallStatus: "on-track",
  stages: [],
};
const ACTIVITY: ParentActivityOption = { id: "a1", name: "Jira triage duty" };

function setup(
  overrides: Partial<Parameters<typeof useItemEditDialog>[0]> = {},
) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const { result } = renderHook(() =>
    useItemEditDialog({
      item: null,
      products: [PRODUCT],
      activities: [],
      week: "current",
      onSave,
      onCancel,
      ...overrides,
    }),
  );
  return { result, onSave, onCancel };
}

describe("useItemEditDialog — characterization", () => {
  it("create-mode defaults: empty text, in-progress status for current week, no priority rank, empty stageIds", () => {
    const { result } = setup({
      defaultProductId: "p1",
      stagesForProduct: () => ["Testing"],
    });

    expect(result.current.text).toBe("");
    expect(result.current.status).toBe("in-progress");
    expect(result.current.priorityRank).toBeNull();
    expect(result.current.stageIds).toEqual([]);
    expect(result.current.parent).toEqual({ kind: "product", id: "p1" });
    expect(result.current.headerVerb).toBe("Add Item");
    expect(result.current.isDeadEnd).toBe(false);
  });

  it("edit-mode seeding: seeds text/status/stageIds/priorityRank from the bound item", () => {
    const item: KanbanItem = {
      id: "item-1",
      productId: "p1",
      productName: "DevOps Tools",
      text: "Existing text",
      status: "completed",
      author: "Someone",
      stageIds: ["Testing"],
      priorityRank: 3,
    };
    const { result } = setup({
      item,
      stagesForProduct: () => ["Testing"],
    });

    expect(result.current.text).toBe("Existing text");
    expect(result.current.status).toBe("completed");
    expect(result.current.stageIds).toEqual(["Testing"]);
    expect(result.current.priorityRank).toBe(3);
    expect(result.current.headerVerb).toBe("Edit Item");
    expect(result.current.parentName).toBe("DevOps Tools");
  });

  it("clears stageIds on a parent switch", () => {
    const item: KanbanItem = {
      id: "item-1",
      productId: "p1",
      productName: "DevOps Tools",
      text: "Existing text",
      status: "in-progress",
      author: "Someone",
      stageIds: ["Testing"],
    };
    const { result } = setup({
      item,
      activities: [ACTIVITY],
      stagesForProduct: () => ["Testing"],
    });

    expect(result.current.stageIds).toEqual(["Testing"]);

    act(() => {
      result.current.onParentChange({ kind: "activity", id: "a1" });
    });

    expect(result.current.parent).toEqual({ kind: "activity", id: "a1" });
    expect(result.current.stageIds).toEqual([]);
  });

  it("isDeadEnd is true for a zero-owned-stage product with no stage of its own", () => {
    const { result } = setup({
      products: [ZERO_STAGE_PRODUCT],
      defaultProductId: "p2",
      stagesForProduct: () => [],
    });

    expect(result.current.isDeadEnd).toBe(true);
  });

  it("handleSave surfaces validation errors and never calls onSave", () => {
    const { result, onSave } = setup({
      defaultProductId: "p1",
      stagesForProduct: () => ["Testing"],
    });

    act(() => {
      result.current.handleSave();
    });

    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.textError).toBe("Description is required");
  });

  it("handleSave calls onSave with a product-parented payload on success", () => {
    const { result, onSave } = setup({
      defaultProductId: "p1",
      stagesForProduct: () => ["Testing"],
    });

    act(() => {
      result.current.onTextChange("Ship the thing");
    });
    act(() => {
      result.current.onStageChange(["Testing"]);
    });
    act(() => {
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]?.[0] as KanbanItem;
    expect(saved.productId).toBe("p1");
    expect(saved.text).toBe("Ship the thing");
    expect(saved.stageIds).toEqual(["Testing"]);
    expect(saved.activityId).toBeNull();
  });

  it("handleSave calls onSave with an activity-parented payload when the parent is an activity", () => {
    const { result, onSave } = setup({
      activities: [ACTIVITY],
      defaultActivityId: "a1",
      stagesForProduct: () => ["Testing"],
    });

    act(() => {
      result.current.onTextChange("Triage the queue");
    });
    act(() => {
      result.current.handleSave();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0]?.[0] as KanbanItem;
    expect(saved.activityId).toBe("a1");
    expect(saved.productId).toBe("");
    expect(saved.text).toBe("Triage the queue");
  });
});
