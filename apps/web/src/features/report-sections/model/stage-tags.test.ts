import { describe, expect, it } from "vitest";

import { canonicalStageNames, riskCoversStage } from "./stage-tags";

describe("riskCoversStage — new stageNames format", () => {
  it("non-empty stageNames: returns true only for listed stages", () => {
    const risk = { stageNames: ["Testing"] };
    expect(riskCoversStage(risk, "Testing")).toBe(true);
    expect(riskCoversStage(risk, "Development")).toBe(false);
  });

  it("stageNames with multiple stages covers each of them", () => {
    const risk = { stageNames: ["Development", "Testing"] };
    expect(riskCoversStage(risk, "Development")).toBe(true);
    expect(riskCoversStage(risk, "Testing")).toBe(true);
    expect(riskCoversStage(risk, "DevOps")).toBe(false);
  });
});

describe("canonicalStageNames", () => {
  it("removes exact duplicate values", () => {
    expect(canonicalStageNames(["Development", "Development"])).toEqual([
      "Development",
    ]);
  });

  it("leaves an already-canonical list unchanged", () => {
    expect(canonicalStageNames(["Development", "DevOps"])).toEqual([
      "Development",
      "DevOps",
    ]);
  });
});
