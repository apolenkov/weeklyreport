import { describe, expect, it, vi } from "vitest";

import {
  createDraftStageMemory,
  type DecisionEntry,
  type Product,
} from "../../report-sections";
import {
  resolveInitialDecisionStageNames,
  type UseDecisionEditDialogArgs,
} from "./decision-edit-dialog-model";

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

const STAGES: Record<string, readonly string[]> = {
  "p-multi": ["Development", "Testing"],
  "p-single": ["Development"],
};

function args(
  overrides: Partial<UseDecisionEditDialogArgs> = {},
): UseDecisionEditDialogArgs {
  return {
    decision: null,
    products: [MULTI_STAGE_PRODUCT, SINGLE_STAGE_PRODUCT],
    activities: [{ id: "a-1", name: "On-call duty" }],
    defaultProductId: MULTI_STAGE_PRODUCT.id,
    stagesForProduct: (productId) => STAGES[productId] ?? [],
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

function remembered(stageName: string, productId = "p-multi") {
  const memory = createDraftStageMemory();
  const recordId = "saved-decision";
  memory.stageChangedSelections([
    { recordId, productId, stageNames: [stageName] },
  ]);
  memory.confirmPersisted({
    items: [],
    risks: [],
    decisions: [{ id: recordId, productId, stageNames: [stageName] }],
  });
  return memory;
}

const MULTI_PARENT = { kind: "product", id: MULTI_STAGE_PRODUCT.id } as const;
const SINGLE_PARENT = { kind: "product", id: SINGLE_STAGE_PRODUCT.id } as const;

function editDecision(stageNames: readonly string[]): DecisionEntry {
  return {
    id: "decision-1",
    productId: MULTI_STAGE_PRODUCT.id,
    productName: MULTI_STAGE_PRODUCT.name,
    activityId: null,
    text: "Approve the vendor",
    owner: "Test Lead",
    impact: "Unblocks delivery",
    deadline: null,
    stageNames,
  };
}

describe("resolveInitialDecisionStageNames — editable draft stage default", () => {
  it("pre-selects the remembered singleton for a new decision", () => {
    expect(
      resolveInitialDecisionStageNames(
        args(),
        MULTI_PARENT,
        remembered("Testing"),
      ),
    ).toEqual(["Testing"]);
  });

  it("starts empty when no eligible stage is remembered", () => {
    expect(
      resolveInitialDecisionStageNames(
        args(),
        MULTI_PARENT,
        createDraftStageMemory(),
      ),
    ).toEqual([]);
  });

  it("keeps the sole owned stage applied for a single-stage product", () => {
    expect(
      resolveInitialDecisionStageNames(
        { ...args(), defaultProductId: SINGLE_STAGE_PRODUCT.id },
        SINGLE_PARENT,
        createDraftStageMemory(),
      ),
    ).toEqual(["Development"]);
  });

  it("restores a saved decision's stages instead of the remembered default", () => {
    expect(
      resolveInitialDecisionStageNames(
        args({ decision: editDecision(["Development", "Testing"]) }),
        MULTI_PARENT,
        remembered("Testing"),
      ),
    ).toEqual(["Development", "Testing"]);
  });

  it("does not select a remembered stage for an activity parent", () => {
    expect(
      resolveInitialDecisionStageNames(
        args(),
        { kind: "activity", id: "a-1" },
        remembered("Testing"),
      ),
    ).toEqual([]);
  });

  it("ignores a remembered stage the product no longer owns", () => {
    const changedOwnership = {
      ...args(),
      stagesForProduct: (productId: string) =>
        productId === MULTI_STAGE_PRODUCT.id ? ["Development"] : [],
    };

    expect(
      resolveInitialDecisionStageNames(
        changedOwnership,
        MULTI_PARENT,
        remembered("Legacy"),
      ),
    ).toEqual(["Development"]);
  });
});
