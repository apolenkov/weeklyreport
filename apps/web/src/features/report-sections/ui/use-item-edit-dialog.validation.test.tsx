import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { firstInvalidControl } from "./item-edit-dialog-helpers";
import { useItemEditDialog } from "./use-item-edit-dialog";

const product = {
  id: "p",
  name: "Product",
  overallStatus: "on-track" as const,
  stages: [],
};
const activity = { id: "a", name: "Activity" };

describe("canonical item validation", () => {
  it("passes a saved next step unchanged to the movement guard when editing across weeks", () => {
    const onSave = vi.fn();
    const item = {
      id: "i",
      parent: { kind: "product" as const, id: "p" },
      productId: "p",
      productName: "Product",
      activityId: null,
      text: "Current work",
      status: "in-progress" as const,
      author: "Lead",
      stageNames: ["Build"],
      nextStepText: "Saved plan",
    };
    const { result, rerender } = renderHook(
      ({ week }: { week: "current" | "next" }) =>
        useItemEditDialog({
          item,
          products: [product],
          activities: [],
          stagesForProduct: () => ["Build"],
          week,
          onSave,
          onCancel: vi.fn(),
        }),
      { initialProps: { week: "current" as "current" | "next" } },
    );
    rerender({ week: "next" });
    act(() => result.current.handleSave());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ nextStepText: "Saved plan" }),
    );
    expect(result.current.nextStepText).toBe("Saved plan");
  });

  it("rejects a next step in next week without clearing it", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useItemEditDialog({
        item: null,
        products: [product],
        activities: [],
        defaultProductId: "p",
        stagesForProduct: () => ["Build"],
        week: "next",
        contextualCreateValidation: true,
        onSave,
        onCancel: vi.fn(),
      }),
    );
    act(() => {
      result.current.onTextChange("Draft");
      result.current.onNextStepTextChange("Later");
    });
    act(() => result.current.handleSave());
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.nextStepTextError).toBeTruthy();
    expect(result.current.nextStepText).toBe("Later");
  });

  it("rejects a stage that becomes ineligible for contextual creation", () => {
    const onSave = vi.fn();
    const { result, rerender } = renderHook(
      ({ stages }) =>
        useItemEditDialog({
          item: null,
          products: [product],
          activities: [],
          defaultProductId: "p",
          stagesForProduct: () => stages,
          week: "current",
          contextualCreateValidation: true,
          onSave,
          onCancel: vi.fn(),
        }),
      { initialProps: { stages: ["Build", "Test"] } },
    );
    act(() => {
      result.current.onTextChange("Draft");
      result.current.onStageChange(["Build"]);
    });
    rerender({ stages: ["Test"] });
    act(() => result.current.handleSave());
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.stageError).toBeTruthy();
    expect(result.current.stageNames).toEqual(["Build"]);
    act(() => result.current.onStageChange([]));
    act(() => result.current.onStageChange(["Test"]));
    act(() => result.current.handleSave());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Draft", stageNames: ["Test"] }),
    );
  });

  it("rejects a deleted activity for contextual creation", () => {
    const onSave = vi.fn();
    const { result, rerender } = renderHook(
      ({ activities }) =>
        useItemEditDialog({
          item: null,
          products: [],
          activities,
          defaultActivityId: "a",
          week: "current",
          contextualCreateValidation: true,
          onSave,
          onCancel: vi.fn(),
        }),
      { initialProps: { activities: [activity] } },
    );
    act(() => result.current.onTextChange("Draft"));
    rerender({ activities: [] });
    act(() => result.current.handleSave());
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.parentError).toBeTruthy();
    expect(result.current.text).toBe("Draft");
  });

  it("preserves a historical product and stage when editing", () => {
    const onSave = vi.fn();
    const item = {
      id: "i",
      parent: { kind: "product" as const, id: "old" },
      productId: "old",
      productName: "Old",
      activityId: null,
      text: "Historical",
      status: "in-progress" as const,
      author: "Lead",
      stageNames: ["Former"],
    };
    const { result } = renderHook(() =>
      useItemEditDialog({
        item,
        products: [],
        activities: [],
        week: "current",
        stagesForProduct: () => [],
        contextualCreateValidation: true,
        onSave,
        onCancel: vi.fn(),
      }),
    );
    act(() => result.current.handleSave());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "old", stageNames: ["Former"] }),
    );
  });

  it("finds invalid controls only in its own surface", () => {
    const outer = document.createElement("div");
    outer.innerHTML =
      '<div><textarea id="item-text"></textarea></div><div><textarea name="text"></textarea></div>';
    document.body.append(outer);
    const surface = outer.lastElementChild as HTMLElement;
    expect(firstInvalidControl({ text: "Required" }, surface)).toBe(
      surface.querySelector('[name="text"]'),
    );
    outer.remove();
  });
});
