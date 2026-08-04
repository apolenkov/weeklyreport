// The context strip must track the selected parent, not the mount-time seed;
// this mirrors the editable stage list after a product switch.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Product } from "../../report-sections";
import { useRiskEditParentStage } from "./use-risk-edit-parent-stage";

const FLAGGED_PRODUCT: Product = {
  id: "p-flagged",
  name: "Payments",
  overallStatus: "at-risk",
  stages: [
    {
      stageName: "Design",
      status: "at-risk",
      ownership: "mine",
      assignee: null,
    },
    {
      stageName: "Build",
      status: "on-track",
      ownership: "mine",
      assignee: null,
    },
  ],
};
const CLEAN_PRODUCT: Product = {
  id: "p-clean",
  name: "Onboarding",
  overallStatus: "on-track",
  stages: [
    {
      stageName: "Design",
      status: "on-track",
      ownership: "mine",
      assignee: null,
    },
  ],
};

const STAGES: Record<string, readonly string[]> = {
  [FLAGGED_PRODUCT.id]: ["Design", "Build"],
  [CLEAN_PRODUCT.id]: ["Design"],
};

function setup() {
  return renderHook(() =>
    useRiskEditParentStage({
      risk: null,
      isCreate: true,
      products: [FLAGGED_PRODUCT, CLEAN_PRODUCT],
      activities: [{ id: "a1", name: "Jira triage duty" }],
      defaultProductId: FLAGGED_PRODUCT.id,
      stagesForProduct: (productId) => STAGES[productId] ?? [],
    }),
  );
}

describe("useRiskEditParentStage — context strip follows the parent", () => {
  it("seeds the strip from the default product's flagged stages", () => {
    const { result } = setup();

    expect(result.current.preCheckedStages).toEqual([
      { name: "Design", severity: "at-risk" },
    ]);
  });

  it("clears the strip when the parent switches to an unflagged product", () => {
    const { result } = setup();

    act(() => {
      result.current.setParentAndStages({
        kind: "product",
        id: CLEAN_PRODUCT.id,
      });
    });

    expect(result.current.preCheckedStages).toEqual([]);
    expect(result.current.parentName).toBe(CLEAN_PRODUCT.name);
  });

  it("clears the strip when the parent switches to an activity", () => {
    const { result } = setup();

    act(() => {
      result.current.setParentAndStages({ kind: "activity", id: "a1" });
    });

    expect(result.current.preCheckedStages).toEqual([]);
  });

  it("re-derives the strip when switching back to the flagged product", () => {
    const { result } = setup();

    act(() => {
      result.current.setParentAndStages({
        kind: "product",
        id: CLEAN_PRODUCT.id,
      });
    });
    act(() => {
      result.current.setParentAndStages({
        kind: "product",
        id: FLAGGED_PRODUCT.id,
      });
    });

    expect(result.current.preCheckedStages).toEqual([
      { name: "Design", severity: "at-risk" },
    ]);
  });
});
