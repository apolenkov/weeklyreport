import { describe, expect, it } from "vitest";

import { deriveEffectiveStageStatus } from "./stage-status";

describe("deriveEffectiveStageStatus", () => {
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
    // Status is derived from risks; a manual blocked that no risk backs
    // collapses rather than surviving as orphaned severity.
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

  it("empty risk and item arrays leave the manual status unchanged", () => {
    // Cross-stage filtering (e.g. stageIds:["Testing"] not bleeding into the
    // Development chip) is the caller's job (mapLeadProducts); this only pins
    // that an empty risks/items array is a no-op on the manual status.
    expect(deriveEffectiveStageStatus("empty", [], [])).toBe("empty");
    expect(deriveEffectiveStageStatus("on-track", [], [])).toBe("on-track");
  });

  it("collapses an explicit at-risk with no backing risk to on-track", () => {
    // A manual at-risk that no risk backs collapses to on-track, matching
    // the sync bridge's reset when the last covering risk is removed.
    expect(deriveEffectiveStageStatus("at-risk", [], [])).toBe("on-track");
  });
});
