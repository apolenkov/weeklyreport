import { describe, expect, it } from "vitest";

import { riskCoversStage, splitStageNames } from "./stage-names";

describe("splitStageNames", () => {
  it("splits separators, trims whitespace, removes empties, and deduplicates", () => {
    expect(
      splitStageNames(" Dev ; Testing, , Dev ;; Support ; Testing "),
    ).toEqual(["Dev", "Testing", "Support"]);
  });
});

describe("riskCoversStage", () => {
  it("matches Dev and Development through populated stageIds", () => {
    expect(riskCoversStage({ stageIds: ["Dev"] }, "Development")).toBe(true);
    expect(riskCoversStage({ stageIds: ["Development"] }, "Dev")).toBe(true);
  });

  it("keeps populated stageIds scoped to their named stages", () => {
    expect(riskCoversStage({ stageIds: ["Testing"] }, "Testing")).toBe(true);
    expect(riskCoversStage({ stageIds: ["Testing"] }, "Development")).toBe(
      false,
    );
  });

  it("treats empty stageIds as covering every owned stage", () => {
    expect(riskCoversStage({ stageIds: [] }, "Development")).toBe(true);
    expect(riskCoversStage({ stageIds: [] }, "Testing")).toBe(true);
  });

  it("falls back to comma- or semicolon-separated legacy stage names", () => {
    const commaSeparated = { stageName: "Dev, Testing" };
    const semicolonSeparated = { stageName: "Planning; Support" };

    expect(riskCoversStage(commaSeparated, "Development")).toBe(true);
    expect(riskCoversStage(commaSeparated, "Testing")).toBe(true);
    expect(riskCoversStage(commaSeparated, "Support")).toBe(false);
    expect(riskCoversStage(semicolonSeparated, "Support")).toBe(true);
  });

  it("treats absent or empty legacy stage names as covering every stage", () => {
    expect(riskCoversStage({}, "Development")).toBe(true);
    expect(riskCoversStage({ stageName: "" }, "Development")).toBe(true);
    expect(riskCoversStage({ stageName: " — " }, "Development")).toBe(true);
  });

  it("a delimiter-only legacy stage name covers NOTHING, not everything", () => {
    // The wildcard is strictly absent/blank/"—": ";;" parses to zero tokens
    // and an empty token list must not widen into covers-every-stage.
    expect(riskCoversStage({ stageName: ";;" }, "Development")).toBe(false);
    expect(riskCoversStage({ stageName: ", ,;" }, "Testing")).toBe(false);
  });
});
