import { describe, expect, it } from "vitest";

import { buildDecisionSaveBase } from "./decision-edit-dialog-helpers";

describe("decision identity", () => {
  it("retains a contextual identity", () => {
    expect(
      buildDecisionSaveBase({
        decision: null,
        id: "id",
        stableId: "lineage",
        text: "Decision",
        owner: "Owner",
        impact: "Impact",
        deadline: "",
      }),
    ).toMatchObject({ id: "id", stableId: "lineage" });
  });
  it("retains the original identity on edit", () => {
    expect(
      buildDecisionSaveBase({
        decision: {
          id: "id",
          stableId: "lineage",
          productId: "p",
          productName: "P",
          text: "Old",
          owner: "Owner",
          impact: "Impact",
          deadline: null,
          stageNames: [],
        },
        text: "New",
        owner: "Owner",
        impact: "Impact",
        deadline: "",
      }),
    ).toMatchObject({ id: "id", stableId: "lineage" });
  });
});
