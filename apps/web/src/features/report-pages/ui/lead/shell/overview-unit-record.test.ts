// Where a unit's "+ Risk" / "+ Decision" sends the Lead: the usual editors,
// with the unit as the record's parent and nothing written yet.
import { describe, expect, it, vi } from "vitest";

import { unitRecordStarter } from "./overview-unit-record";
import type { ReadyEditor } from "./use-overview-controller";

function editor() {
  const routeToBlocker = vi.fn();
  const addDecisionFor = vi.fn();
  const apply = vi.fn();
  return {
    routeToBlocker,
    addDecisionFor,
    apply,
    handle: {
      draft: { routeToBlocker, apply },
      view: { draftActions: { addDecisionFor } },
    } as unknown as ReadyEditor,
  };
}

describe("unitRecordStarter", () => {
  it("offers nothing without a ready editor", () => {
    expect(unitRecordStarter(null)).toBeUndefined();
  });

  it("opens the risk editor on the Product, with severity still explicit and no stage guessed", () => {
    const { handle, routeToBlocker, apply } = editor();

    unitRecordStarter(handle)?.({
      kind: "risk",
      unitKind: "product",
      unitId: "product-1",
    });

    expect(routeToBlocker).toHaveBeenCalledWith({
      productId: "product-1",
      stageNames: [],
      severity: "at-risk",
    });
    expect(apply).not.toHaveBeenCalled();
  });

  it("opens the risk editor on the Activity without inventing a Product", () => {
    const { handle, routeToBlocker } = editor();

    unitRecordStarter(handle)?.({
      kind: "risk",
      unitKind: "activity",
      unitId: "activity-1",
    });

    expect(routeToBlocker).toHaveBeenCalledWith({
      productId: "",
      stageNames: [],
      severity: "at-risk",
      activityId: "activity-1",
    });
  });

  it.each([
    ["product", { productId: "unit-1" }],
    ["activity", { activityId: "unit-1" }],
  ] as const)(
    "opens the decision editor on the %s it was raised from",
    (unitKind, seed) => {
      const { handle, addDecisionFor, routeToBlocker } = editor();

      unitRecordStarter(handle)?.({
        kind: "decision",
        unitKind,
        unitId: "unit-1",
      });

      expect(addDecisionFor).toHaveBeenCalledWith(seed);
      expect(routeToBlocker).not.toHaveBeenCalled();
    },
  );
});
