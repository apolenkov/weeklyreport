import { describe, expect, it } from "vitest";

import {
  canonicalStageName,
  canonicalStageNames,
  riskCoversStage,
  splitStageNames,
} from "./stage-tags";

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

describe("riskCoversStage — new stageNames format", () => {
  it("empty stageNames means all stages (applies everywhere)", () => {
    expect(riskCoversStage({ stageNames: [] }, "Development")).toBe(true);
    expect(riskCoversStage({ stageNames: [] }, "Testing")).toBe(true);
  });

  it("non-empty stageNames: returns true only for listed stages", () => {
    const risk = { stageNames: ["Testing"] };
    expect(riskCoversStage(risk, "Testing")).toBe(true);
    expect(riskCoversStage(risk, "Development")).toBe(false);
  });

  it("stageNames beats undefined stageName — a Testing-only risk does NOT cover Development", () => {
    // Regression: old stageNameMatches(undefined, "Development") returned true.
    // riskCoversStage must return false when stageNames is ["Testing"].
    const newFormatRisk = { stageName: undefined, stageNames: ["Testing"] };
    expect(riskCoversStage(newFormatRisk, "Development")).toBe(false);
    expect(riskCoversStage(newFormatRisk, "Testing")).toBe(true);
  });

  it("stageNames with multiple stages covers each of them", () => {
    const risk = { stageNames: ["Development", "Testing"] };
    expect(riskCoversStage(risk, "Development")).toBe(true);
    expect(riskCoversStage(risk, "Testing")).toBe(true);
    expect(riskCoversStage(risk, "DevOps")).toBe(false);
  });
});

describe("riskCoversStage — legacy stageName fallback", () => {
  it("falls back to stageName CSV when stageNames is absent", () => {
    expect(riskCoversStage({ stageName: "Development" }, "Development")).toBe(
      true,
    );
    expect(riskCoversStage({ stageName: "Development" }, "Testing")).toBe(
      false,
    );
  });

  it("legacy undefined stageName means all stages (backward compat)", () => {
    expect(riskCoversStage({ stageName: undefined }, "Development")).toBe(true);
  });

  it("legacy 'Dev' stageName covers 'Development' (canonicalized fallback, 1.3)", () => {
    expect(riskCoversStage({ stageName: "Dev" }, "Development")).toBe(true);
    expect(riskCoversStage({ stageName: "Dev, Testing" }, "Development")).toBe(
      true,
    );
  });
});

describe("riskCoversStage — Dev↔Development alias", () => {
  it("chip label 'Dev' matches stageNames containing 'Development'", () => {
    expect(riskCoversStage({ stageNames: ["Development"] }, "Dev")).toBe(true);
  });

  it("canonical name 'Development' matches stageNames containing canonical", () => {
    expect(
      riskCoversStage({ stageNames: ["Development"] }, "Development"),
    ).toBe(true);
  });

  it("unrelated stage is still rejected after alias normalisation", () => {
    expect(riskCoversStage({ stageNames: ["Testing"] }, "Dev")).toBe(false);
  });
});

describe("canonicalStageName", () => {
  it("normalises 'Dev' → 'Development'", () => {
    expect(canonicalStageName("Dev")).toBe("Development");
  });

  it("passes through unknown stage names unchanged", () => {
    expect(canonicalStageName("Testing")).toBe("Testing");
    expect(canonicalStageName("DevOps")).toBe("DevOps");
  });
});

describe("canonicalStageNames", () => {
  it("canonicalises every id (legacy 'Dev' → 'Development')", () => {
    expect(canonicalStageNames(["Dev", "Testing"])).toEqual([
      "Development",
      "Testing",
    ]);
  });

  it("drops duplicates that collapse after aliasing", () => {
    expect(canonicalStageNames(["Dev", "Development"])).toEqual([
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
