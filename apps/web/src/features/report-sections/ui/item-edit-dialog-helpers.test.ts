import { describe, expect, it } from "vitest";

import {
  buildActivityItemSave,
  buildProductItemSave,
  collectItemErrors,
  collectItemStatusErrors,
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

// The server refuses invisible-only text, so the editor refuses it before the
// draft autosave instead of rewriting it.
describe("item status text follows the server visible-text rule", () => {
  it("requires a visible pause reason", () => {
    expect(
      collectItemStatusErrors({
        status: "paused",
        trimmedNextStepText: "",
        trimmedPausedReason: "\u200B",
      }).pausedReason,
    ).toBe("A reason is required to pause an item.");
  });

  it("refuses an invisible-only next step instead of dropping it", () => {
    expect(
      collectItemStatusErrors({
        status: "in-progress",
        trimmedNextStepText: "\u200B",
        trimmedPausedReason: "",
      }).nextStepText,
    ).toBe("Text must contain visible characters");
    expect(
      collectItemStatusErrors({
        status: "in-progress",
        trimmedNextStepText: "",
        trimmedPausedReason: "",
      }),
    ).toEqual({});
  });
});
