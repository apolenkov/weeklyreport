import { describe, expect, it } from "vitest";

import {
  normalizeStageName,
  riskCoversStage,
  stageNamesMatch,
} from "./stage-names";

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

  it("treats empty stageNames as covering every owned stage", () => {
    expect(riskCoversStage({ stageNames: [] }, "Development")).toBe(true);
    expect(riskCoversStage({ stageNames: [] }, "Testing")).toBe(true);
  });

  it("keeps the empty structured set as the current all-stages rule", () => {
    expect(riskCoversStage({ stageNames: [] }, "Development")).toBe(true);
    expect(riskCoversStage({ stageNames: [] }, "Testing")).toBe(true);
  });

  it("rejects records without structured stage names", () => {
    expect(riskCoversStage({}, "Development")).toBe(false);
  });
});

describe("stage identity", () => {
  it("does not collapse aliases or case variants", () => {
    expect(stageNamesMatch("Dev", "Development")).toBe(false);
    expect(stageNamesMatch("testing", "Testing")).toBe(false);
    expect(normalizeStageName("Development")).toBe("Development");
  });
});
