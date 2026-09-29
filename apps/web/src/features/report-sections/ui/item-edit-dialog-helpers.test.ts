import { describe, expect, it } from "vitest";

import {
  buildActivityItemSave,
  buildProductItemSave,
  collectItemErrors,
  resolveInitialItem,
} from "./item-edit-dialog-helpers";

describe("item description contract", () => {
  const validate = (trimmed: string) =>
    collectItemErrors({
      trimmed,
      isActivityParent: true,
      availableStages: [],
      effectiveStageNames: [],
    });

  it("accepts the minimum and maximum server-supported text", () => {
    expect(validate("X")).toEqual({});
    expect(validate("X".repeat(500))).toEqual({});
  });

  it("keeps invalid descriptions in the editor before mutating the draft", () => {
    expect(validate("").text).toBe("Description is required");
    expect(validate("X".repeat(501)).text).toBe(
      "Description must be 500 characters or fewer.",
    );
    expect(validate("\u200B").text).toBeDefined();
    expect(validate("text\u0000").text).toBeDefined();
  });
});

describe("item author resolution", () => {
  it("uses the real user name when present", () => {
    const item = resolveInitialItem({
      item: null,
      week: "current",
      seedProduct: undefined,
      currentUserName: "Alex Lead",
    });
    expect(item.author).toBe("Alex Lead");
  });

  it("never fabricates a synthetic author when the user name is absent", () => {
    const initial = resolveInitialItem({
      item: null,
      week: "current",
      seedProduct: undefined,
      currentUserName: undefined,
    });
    expect(initial.author).toBe("");

    const activitySave = buildActivityItemSave({
      item: null,
      trimmed: "work",
      status: "in-progress",
      currentUserName: undefined,
      priorityRank: null,
      trimmedPausedReason: "",
      trimmedNextStepText: "",
      selectedActivity: undefined,
      initial,
      activityId: "act-1",
    });
    expect(activitySave.author).toBe("");

    const productSave = buildProductItemSave({
      item: null,
      trimmed: "work",
      status: "in-progress",
      currentUserName: undefined,
      priorityRank: null,
      trimmedPausedReason: "",
      trimmedNextStepText: "",
      product: { id: "p1", name: "Portal" },
      effectiveStageNames: [],
    });
    expect(productSave.author).toBe("");
  });
});
