import { describe, expect, it, vi } from "vitest";

import { createItemEditDraftStore } from "./item-edit-draft-store";

const seed = {
  item: null,
  products: [],
  activities: [],
  week: "current",
} as const;

describe("open item draft store", () => {
  it("keeps every authored field independently and leaves old snapshots immutable", () => {
    const store = createItemEditDraftStore(seed);
    const original = store.getSnapshot();
    store.setters.setText("Result");
    store.setters.setNextStepText("Next commitment");
    store.setters.setStatus("paused");
    store.setters.setPausedReason("Waiting for access");
    store.setters.setParent({ kind: "activity", id: "activity" });
    store.setters.setPriorityRank(2);
    store.setters.setStageNames(["Development", "Testing"]);
    expect(store.getSnapshot()).toEqual({
      text: "Result",
      nextStepText: "Next commitment",
      status: "paused",
      pausedReason: "Waiting for access",
      parent: { kind: "activity", id: "activity" },
      priorityRank: 2,
      stageNames: ["Development", "Testing"],
    });
    expect(original.text).toBe("");
    expect(original.stageNames).toEqual([]);
    expect(createItemEditDraftStore(seed).getSnapshot().text).toBe("");
  });

  it("supports functional updates and removes only the subscribed listener", () => {
    const store = createItemEditDraftStore(seed);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.setters.setText("Result");
    store.setters.setText((previous) => `${previous} retained`);
    store.setters.setText("Result retained");
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.setters.setNextStepText("Later");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().text).toBe("Result retained");
  });
});
