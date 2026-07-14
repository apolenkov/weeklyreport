import { describe, expect, it } from "vitest";

import { deriveEffectiveStageStatus } from "./stage-status";

describe("deriveEffectiveStageStatus", () => {
  it("returns empty when no risks or items", () => {
    expect(deriveEffectiveStageStatus("empty", [], [])).toBe("empty");
  });

  it("elevates to at-risk from a single at-risk risk", () => {
    expect(
      deriveEffectiveStageStatus("empty", [{ severity: "at-risk" }], []),
    ).toBe("at-risk");
  });

  it("elevates to blocked from a single blocked risk", () => {
    expect(
      deriveEffectiveStageStatus("empty", [{ severity: "blocked" }], []),
    ).toBe("blocked");
  });

  it("elevates to blocked from a blocked KanbanItem", () => {
    expect(
      deriveEffectiveStageStatus("empty", [], [{ workflowStatus: "blocked" }]),
    ).toBe("blocked");
  });

  it("max wins: explicit on-track + at-risk risk → at-risk", () => {
    expect(
      deriveEffectiveStageStatus("on-track", [{ severity: "at-risk" }], []),
    ).toBe("at-risk");
  });

  it("collapses an explicit blocked with no backing risk to on-track", () => {
    // rethink-pipeline-state-vs-completeness: status is derived from risks;
    // a manual blocked that no risk backs can no longer survive.
    expect(deriveEffectiveStageStatus("blocked", [], [])).toBe("on-track");
  });

  it("multi-risk priority: blocked wins over at-risk on one stage", () => {
    expect(
      deriveEffectiveStageStatus(
        "on-track",
        [{ severity: "at-risk" }, { severity: "blocked" }],
        [],
      ),
    ).toBe("blocked");
  });

  it("section isolation: risks for another stage do not bleed into this chip", () => {
    // Regression for #10: risks filtered to stageIds:["Testing"] must not
    // affect the Development chip. The caller (mapLeadProducts) does the
    // filtering; we verify that an empty risks/items array leaves the chip alone.
    expect(deriveEffectiveStageStatus("empty", [], [])).toBe("empty");
    expect(deriveEffectiveStageStatus("on-track", [], [])).toBe("on-track");
  });

  it("collapses an explicit at-risk with no backing risk to on-track", () => {
    // A manual at-risk that no risk backs collapses to on-track, matching
    // the sync bridge's reset when the last covering risk is removed.
    expect(deriveEffectiveStageStatus("at-risk", [], [])).toBe("on-track");
  });
});
