// The context strip must track the selected parent, not the mount-time seed;
// this mirrors the editable stage list after a product switch.
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  createDraftStageMemory,
  DraftStageMemoryProvider,
  type Product,
  type RiskEntry,
} from "../../report-sections";
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

function setup(defaultProductId: string | undefined = FLAGGED_PRODUCT.id) {
  return renderHook(() =>
    useRiskEditParentStage({
      risk: null,
      isCreate: true,
      products: [FLAGGED_PRODUCT, CLEAN_PRODUCT],
      activities: [{ id: "a1", name: "Jira triage duty" }],
      defaultProductId,
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

// An explicit stale seed must not rebind to products[0] or fall through to
// the first activity — the lead resolves the parent explicitly.
describe("useRiskEditParentStage — stale create seed", () => {
  it("leaves the parent unresolved when the requested product id is absent from the catalog", () => {
    const { result } = setup("p-stale");

    expect(result.current.parent).toEqual({ kind: "unresolved" });
    expect(result.current.parentName).toBe("");
    expect(result.current.preCheckedStages).toEqual([]);
  });
});

describe("useRiskEditParentStage — editable draft stage default", () => {
  function setupWithMemory(
    rememberedStageName: string | undefined,
    overrides: {
      readonly risk?: RiskEntry | null;
      readonly isCreate?: boolean;
      readonly defaultProductId?: string | undefined;
      readonly defaultActivityId?: string | undefined;
      readonly initialStageNames?: readonly string[];
    } = {},
  ) {
    const memory = createDraftStageMemory();
    if (rememberedStageName !== undefined) {
      const recordId = "saved-risk";
      const productId = overrides.risk?.productId ?? FLAGGED_PRODUCT.id;
      memory.stageChangedSelections([
        { recordId, productId, stageNames: [rememberedStageName] },
      ]);
      memory.confirmPersisted({
        items: [],
        risks: [
          {
            id: recordId,
            projectId: productId,
            stageNames: [rememberedStageName],
          },
        ],
        decisions: [],
      });
    }
    const args = {
      risk: overrides.risk ?? null,
      isCreate: overrides.isCreate ?? true,
      products: [FLAGGED_PRODUCT, CLEAN_PRODUCT],
      activities: [{ id: "a1", name: "Jira triage duty" }],
      defaultProductId:
        "defaultProductId" in overrides
          ? overrides.defaultProductId
          : FLAGGED_PRODUCT.id,
      ...(overrides.defaultActivityId !== undefined
        ? { defaultActivityId: overrides.defaultActivityId }
        : {}),
      ...(overrides.initialStageNames !== undefined
        ? { initialStageNames: overrides.initialStageNames }
        : {}),
      stagesForProduct: (productId: string) => STAGES[productId] ?? [],
    };
    return renderHook(() => useRiskEditParentStage(args), {
      wrapper: ({ children }) => (
        <DraftStageMemoryProvider memory={memory}>
          {children}
        </DraftStageMemoryProvider>
      ),
    });
  }

  it("pre-selects the remembered singleton for a new risk", () => {
    const { result } = setupWithMemory("Build");

    expect(result.current.stageNames).toEqual(["Build"]);
    expect(result.current.effectiveStageNames).toEqual(["Build"]);
  });

  it("lets an explicit originating-stage prefill beat the remembered stage", () => {
    const { result } = setupWithMemory("Build", {
      initialStageNames: ["Design"],
    });

    expect(result.current.stageNames).toEqual(["Design"]);
  });

  it("keeps a deliberate multi-stage prefill", () => {
    const { result } = setupWithMemory(undefined, {
      initialStageNames: ["Design", "Build"],
    });

    expect(result.current.stageNames).toEqual(["Design", "Build"]);
  });

  it("restores a saved risk's stages instead of the remembered default", () => {
    const { result } = setupWithMemory("Build", {
      isCreate: false,
      risk: {
        id: "risk-1",
        productId: FLAGGED_PRODUCT.id,
        productName: FLAGGED_PRODUCT.name,
        activityId: null,
        stageNames: ["Design"],
        severity: "at-risk",
        text: "Vendor delay",
        impact: "Slips the milestone",
        mitigation: "Escalate",
      },
    });

    expect(result.current.stageNames).toEqual(["Design"]);
  });

  it("does not apply a remembered product stage to an activity parent", () => {
    const { result } = setupWithMemory("Build", {
      defaultProductId: undefined,
      defaultActivityId: "a1",
    });

    expect(result.current.parent).toEqual({ kind: "activity", id: "a1" });
    expect(result.current.stageNames).toEqual([]);
  });

  it("clears the remembered stage when the parent changes", () => {
    const { result } = setupWithMemory("Build");
    expect(result.current.stageNames).toEqual(["Build"]);

    act(() => {
      result.current.setParentAndStages({
        kind: "product",
        id: CLEAN_PRODUCT.id,
      });
    });

    // The previous parent's choice is cleared; only the new parent's sole
    // owned stage auto-applies.
    expect(result.current.stageNames).toEqual([]);
    expect(result.current.effectiveStageNames).toEqual(["Design"]);
  });

  it("starts empty without memory on a multi-stage product", () => {
    const { result } = setupWithMemory(undefined);

    expect(result.current.stageNames).toEqual([]);
  });

  it("still auto-applies a sole owned stage without memory", () => {
    const { result } = setupWithMemory(undefined, {
      defaultProductId: CLEAN_PRODUCT.id,
    });

    expect(result.current.effectiveStageNames).toEqual(["Design"]);
  });
});
