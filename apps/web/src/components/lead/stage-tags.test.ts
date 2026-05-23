import { describe, it, expect } from "vitest";
import { riskCoversStage, splitStageNames, stageNameMatches } from "./stage-tags";

describe("splitStageNames", () => {
  it("returns empty for null/undefined/empty", () => {
    expect(splitStageNames(null)).toEqual([]);
    expect(splitStageNames(undefined)).toEqual([]);
    expect(splitStageNames("")).toEqual([]);
    expect(splitStageNames("—")).toEqual([]);
  });

  it("splits CSV and semicolon", () => {
    expect(splitStageNames("Dev, Testing")).toEqual(["Dev", "Testing"]);
    expect(splitStageNames("Dev;Testing")).toEqual(["Dev", "Testing"]);
  });
});

describe("stageNameMatches", () => {
  it("returns true for empty stageName (all-stages legacy sentinel)", () => {
    expect(stageNameMatches(undefined, "Development")).toBe(true);
    expect(stageNameMatches(null, "Development")).toBe(true);
  });

  it("returns true when stage is in the CSV list", () => {
    expect(stageNameMatches("Development, Testing", "Development")).toBe(true);
  });

  it("returns false when stage is not in the CSV list", () => {
    expect(stageNameMatches("Testing", "Development")).toBe(false);
  });
});

describe("riskCoversStage — new stageIds format", () => {
  it("empty stageIds means all stages (applies everywhere)", () => {
    expect(riskCoversStage({ stageIds: [] }, "Development")).toBe(true);
    expect(riskCoversStage({ stageIds: [] }, "Testing")).toBe(true);
  });

  it("non-empty stageIds: returns true only for listed stages", () => {
    const risk = { stageIds: ["Testing"] };
    expect(riskCoversStage(risk, "Testing")).toBe(true);
    expect(riskCoversStage(risk, "Development")).toBe(false);
  });

  it("stageIds beats undefined stageName — a Testing-only risk does NOT cover Development", () => {
    // Regression: old stageNameMatches(undefined, "Development") returned true.
    // riskCoversStage must return false when stageIds is ["Testing"].
    const newFormatRisk = { stageName: undefined, stageIds: ["Testing"] };
    expect(riskCoversStage(newFormatRisk, "Development")).toBe(false);
    expect(riskCoversStage(newFormatRisk, "Testing")).toBe(true);
  });

  it("stageIds with multiple stages covers each of them", () => {
    const risk = { stageIds: ["Development", "Testing"] };
    expect(riskCoversStage(risk, "Development")).toBe(true);
    expect(riskCoversStage(risk, "Testing")).toBe(true);
    expect(riskCoversStage(risk, "DevOps")).toBe(false);
  });
});

describe("riskCoversStage — legacy stageName fallback", () => {
  it("falls back to stageName CSV when stageIds is absent", () => {
    expect(riskCoversStage({ stageName: "Development" }, "Development")).toBe(true);
    expect(riskCoversStage({ stageName: "Development" }, "Testing")).toBe(false);
  });

  it("legacy undefined stageName means all stages (backward compat)", () => {
    expect(riskCoversStage({ stageName: undefined }, "Development")).toBe(true);
  });
});
