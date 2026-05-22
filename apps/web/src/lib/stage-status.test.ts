import { describe, it, expect } from "vitest";
import { deriveEffectiveStageStatus } from "./stage-status";

describe("deriveEffectiveStageStatus", () => {
  it("returns empty when no risks or items", () => {
    expect(deriveEffectiveStageStatus("empty", [], [])).toBe("empty");
  });

  it("elevates to at-risk from a single at-risk risk", () => {
    expect(deriveEffectiveStageStatus("empty", [{ severity: "at-risk" }], [])).toBe("at-risk");
  });

  it("elevates to blocked from a single blocked risk", () => {
    expect(deriveEffectiveStageStatus("empty", [{ severity: "blocked" }], [])).toBe("blocked");
  });

  it("elevates to blocked from a blocked KanbanItem", () => {
    expect(deriveEffectiveStageStatus("empty", [], [{ workflowStatus: "blocked" }])).toBe("blocked");
  });

  it("max wins: explicit on-track + at-risk risk → at-risk", () => {
    expect(deriveEffectiveStageStatus("on-track", [{ severity: "at-risk" }], [])).toBe("at-risk");
  });

  it("stays blocked when explicit is blocked and no risks/items", () => {
    expect(deriveEffectiveStageStatus("blocked", [], [])).toBe("blocked");
  });
});
