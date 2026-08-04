import { describe, expect, it } from "vitest";

import {
  buildActivityItemSave,
  buildProductItemSave,
  resolveInitialItem,
} from "./item-edit-dialog-helpers";

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
      product: { id: "p1", name: "Portal" },
      effectiveStageNames: [],
    });
    expect(productSave.author).toBe("");
  });
});
