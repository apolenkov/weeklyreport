import { describe, expect, it } from "vitest";

import { resolveInitialStageNames } from "./stage-ownership";

const MULTI_STAGE = ["Planning", "Development", "Testing"];
const SINGLE_STAGE = ["Development"];

describe("resolveInitialStageNames — editable draft stage default", () => {
  it("restores saved edit stages and never substitutes a remembered default", () => {
    expect(
      resolveInitialStageNames({
        isCreate: false,
        storedStageNames: ["Testing"],
        rememberedStageName: "Development",
        availableStages: MULTI_STAGE,
      }),
    ).toEqual(["Testing"]);
    expect(
      resolveInitialStageNames({
        isCreate: false,
        storedStageNames: [],
        rememberedStageName: "Development",
        availableStages: MULTI_STAGE,
      }),
    ).toEqual([]);
  });

  it("lets an explicit contextual prefill win over the remembered stage", () => {
    expect(
      resolveInitialStageNames({
        isCreate: true,
        explicitStageNames: ["Testing"],
        rememberedStageName: "Development",
        availableStages: MULTI_STAGE,
      }),
    ).toEqual(["Testing"]);
  });

  it("selects the remembered stage alone when the product still owns it", () => {
    expect(
      resolveInitialStageNames({
        isCreate: true,
        rememberedStageName: "Development",
        availableStages: MULTI_STAGE,
      }),
    ).toEqual(["Development"]);
  });

  it("starts empty without an eligible remembered stage or prefill", () => {
    expect(
      resolveInitialStageNames({
        isCreate: true,
        availableStages: MULTI_STAGE,
      }),
    ).toEqual([]);
  });

  it("never expands a default to every owned stage", () => {
    const selected = resolveInitialStageNames({
      isCreate: true,
      rememberedStageName: "Testing",
      availableStages: MULTI_STAGE,
    });

    expect(selected).toEqual(["Testing"]);
    expect(selected).not.toEqual(MULTI_STAGE);
  });

  it("ignores a remembered stage the product no longer owns", () => {
    expect(
      resolveInitialStageNames({
        isCreate: true,
        rememberedStageName: "Legacy",
        availableStages: ["Development", "Testing"],
      }),
    ).toEqual([]);
    // Changed ownership leaving one owned stage keeps the sole-stage shortcut.
    expect(
      resolveInitialStageNames({
        isCreate: true,
        rememberedStageName: "Legacy",
        availableStages: ["Testing"],
      }),
    ).toEqual(["Testing"]);
  });

  it("keeps the sole owned stage shortcut with or without memory", () => {
    expect(
      resolveInitialStageNames({
        isCreate: true,
        availableStages: SINGLE_STAGE,
      }),
    ).toEqual(SINGLE_STAGE);
    expect(
      resolveInitialStageNames({
        isCreate: true,
        rememberedStageName: "Development",
        availableStages: SINGLE_STAGE,
      }),
    ).toEqual(SINGLE_STAGE);
  });

  it("selects nothing for an activity parent, which owns no stage", () => {
    expect(
      resolveInitialStageNames({
        isCreate: true,
        rememberedStageName: "Development",
        availableStages: [],
      }),
    ).toEqual([]);
  });
});
