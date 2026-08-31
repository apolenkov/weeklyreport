import { describe, expect, it } from "vitest";

import { riskCoversStage } from "./stage-names";

describe("riskCoversStage", () => {
  it("matches only the exact canonical stage name", () => {
    expect(
      riskCoversStage({ stageNames: ["Development"] }, "Development"),
    ).toBe(true);
    expect(riskCoversStage({ stageNames: ["Dev"] }, "Development")).toBe(false);
  });

  it("keeps populated stageNames scoped to their named stages", () => {
    expect(riskCoversStage({ stageNames: ["Testing"] }, "Testing")).toBe(true);
    expect(riskCoversStage({ stageNames: ["Testing"] }, "Development")).toBe(
      false,
    );
  });

  it("does not treat an empty stage set as covering any product stage", () => {
    expect(riskCoversStage({ stageNames: [] }, "Development")).toBe(false);
    expect(riskCoversStage({ stageNames: [] }, "Testing")).toBe(false);
  });

  it("rejects records without structured stage names", () => {
    expect(riskCoversStage({}, "Development")).toBe(false);
  });
});
