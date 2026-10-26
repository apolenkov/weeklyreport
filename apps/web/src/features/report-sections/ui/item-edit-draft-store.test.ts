import { describe, expect, it, vi } from "vitest";

import { createDraftStageMemory } from "../model/draft-stage-memory";
import type { Product } from "../model/types";
import { createItemEditDraftStore } from "./item-edit-draft-store";

const seed = {
  item: null,
  products: [],
  activities: [],
  week: "current",
} as const;

const MULTI_STAGE_PRODUCT: Product = {
  id: "p-multi",
  name: "Payments",
  overallStatus: "on-track",
  stages: [
    {
      stageName: "Development",
      status: "on-track",
      ownership: "mine",
      assignee: null,
    },
    {
      stageName: "Testing",
      status: "on-track",
      ownership: "mine",
      assignee: null,
    },
  ],
};

const SINGLE_STAGE_PRODUCT: Product = {
  id: "p-single",
  name: "Onboarding",
  overallStatus: "on-track",
  stages: [
    {
      stageName: "Development",
      status: "on-track",
      ownership: "mine",
      assignee: null,
    },
  ],
};

const OTHER_PRODUCT: Product = {
  id: "p-other",
  name: "Billing",
  overallStatus: "on-track",
  stages: [
    {
      stageName: "Analysis",
      status: "on-track",
      ownership: "mine",
      assignee: null,
    },
  ],
};

const STAGES: Record<string, readonly string[]> = {
  "p-multi": ["Development", "Testing"],
  "p-single": ["Development"],
  "p-other": ["Analysis"],
};

function stagesForProduct(productId: string): readonly string[] {
  return STAGES[productId] ?? [];
}

function remembered(stageName: string, productId = "p-multi") {
  const memory = createDraftStageMemory();
  const recordId = "saved-item";
  memory.stageChangedSelections([
    { recordId, productId, stageNames: [stageName] },
  ]);
  memory.confirmPersisted({
    items: [{ id: recordId, projectId: productId, stageNames: [stageName] }],
    risks: [],
    decisions: [],
  });
  return memory;
}

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

describe("create item draft store — editable draft stage default", () => {
  it("pre-selects the remembered singleton of this product for a new item", () => {
    const store = createItemEditDraftStore({
      ...seed,
      products: [MULTI_STAGE_PRODUCT],
      defaultProductId: MULTI_STAGE_PRODUCT.id,
      stageMemory: remembered("Testing"),
      stagesForProduct,
    });

    expect(store.getSnapshot().stageNames).toEqual(["Testing"]);
    // The default stays a normal editable selection, never a lock.
    store.setters.setStageNames(["Development", "Testing"]);
    expect(store.getSnapshot().stageNames).toEqual(["Development", "Testing"]);
  });

  it("starts a multi-stage product empty without an eligible remembered stage", () => {
    const store = createItemEditDraftStore({
      ...seed,
      products: [MULTI_STAGE_PRODUCT],
      defaultProductId: MULTI_STAGE_PRODUCT.id,
      stageMemory: createDraftStageMemory(),
      stagesForProduct,
    });

    expect(store.getSnapshot().stageNames).toEqual([]);
  });

  it("does not leak a remembered stage from another product", () => {
    const store = createItemEditDraftStore({
      ...seed,
      products: [MULTI_STAGE_PRODUCT, OTHER_PRODUCT],
      defaultProductId: MULTI_STAGE_PRODUCT.id,
      stageMemory: remembered("Analysis", OTHER_PRODUCT.id),
      stagesForProduct,
    });

    expect(store.getSnapshot().stageNames).toEqual([]);
  });

  it("keeps a sole owned stage applied without another click", () => {
    const store = createItemEditDraftStore({
      ...seed,
      products: [SINGLE_STAGE_PRODUCT],
      defaultProductId: SINGLE_STAGE_PRODUCT.id,
      stagesForProduct,
    });

    expect(store.getSnapshot().stageNames).toEqual(["Development"]);
  });

  it("does not overwrite the saved stages of an edited record", () => {
    const store = createItemEditDraftStore({
      ...seed,
      item: {
        id: "item-1",
        parent: { kind: "product", id: MULTI_STAGE_PRODUCT.id },
        productId: MULTI_STAGE_PRODUCT.id,
        productName: MULTI_STAGE_PRODUCT.name,
        activityId: null,
        text: "Ship the importer",
        status: "in-progress",
        author: "Test Lead",
        stageNames: ["Development", "Testing"],
      },
      products: [MULTI_STAGE_PRODUCT],
      stageMemory: remembered("Testing"),
      stagesForProduct,
    });

    expect(store.getSnapshot().stageNames).toEqual(["Development", "Testing"]);
  });

  it("starts an activity-parented item without any stage default", () => {
    const store = createItemEditDraftStore({
      ...seed,
      products: [MULTI_STAGE_PRODUCT],
      activities: [{ id: "a-1", name: "On-call duty" }],
      defaultActivityId: "a-1",
      stageMemory: remembered("Testing"),
      stagesForProduct,
    });

    expect(store.getSnapshot().parent).toEqual({ kind: "activity", id: "a-1" });
    expect(store.getSnapshot().stageNames).toEqual([]);
  });
});
