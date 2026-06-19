/**
 * @vitest-environment node
 *
 * pipeline-tooltip-and-indicator: the "+N more" reveal must name a hidden
 * stage's OWNER even when that owner has not set a status — the line MUST read
 * "<stage> — <owner> (no status set)", never "empty" and never "unassigned",
 * for a stage that has an owner. This owned-but-unstatused branch
 * (`hiddenStageLine` in sdlc-hidden-stages.ts) was previously exercised only
 * indirectly through the pipeline fixtures; these assertions pin the wording
 * for both an empty co-owner (cross-author) and an empty locked owner.
 */
import { describe, expect, it } from "vitest";

import type { StageAssignment } from "./mock-data";
import {
  foreignOwnersForProduct,
  hiddenStagesRevealLines,
} from "./sdlc-hidden-stages";
import type { CrossAuthorEntry } from "./sdlc-pipeline";

const PRODUCT_ID = "p1";

function hiddenStage(
  stageName: string,
  ownership: StageAssignment["ownership"],
  status: StageAssignment["status"],
  assignee: string | null,
): StageAssignment {
  return { stageName, status, ownership, assignee };
}

function crossAuthor(
  stageName: string,
  status: "green" | "yellow" | "red" | null,
  authorInitials = "MK",
): CrossAuthorEntry {
  return {
    projectId: PRODUCT_ID,
    projectName: "P1",
    authorId: "a2",
    authorInitials,
    stageNames: [stageName],
    stages: [{ stageName, status }],
  };
}

describe("hiddenStagesRevealLines — owned-but-unstatused reveal", () => {
  it("a co-owner with no status reads '<stage> — <owner> (no status set)'", () => {
    const foreignOwners = foreignOwnersForProduct(PRODUCT_ID, [
      crossAuthor("DevOps", null),
    ]);
    const lines = hiddenStagesRevealLines(
      [hiddenStage("DevOps", "unassigned", "empty", null)],
      foreignOwners,
    );
    expect(lines).toEqual(["DevOps — MK (no status set)"]);
    expect(lines[0]).not.toContain("empty");
    expect(lines[0]).not.toContain("unassigned");
  });

  it("a locked owned stage with empty status reads '(no status set)', not 'empty'", () => {
    const lines = hiddenStagesRevealLines(
      [hiddenStage("Design", "locked", "empty", "OL")],
      new Map(),
    );
    expect(lines).toEqual(["Design — OL (no status set)"]);
    expect(lines[0]).not.toContain("empty");
  });

  it("a co-owner WITH a status still reads '<owner>: <status>' (contrast)", () => {
    const foreignOwners = foreignOwnersForProduct(PRODUCT_ID, [
      crossAuthor("DevOps", "red"),
    ]);
    const lines = hiddenStagesRevealLines(
      [hiddenStage("DevOps", "unassigned", "empty", null)],
      foreignOwners,
    );
    expect(lines).toEqual(["DevOps — MK: blocked"]);
  });

  it("a genuinely unowned stage reads 'unassigned'", () => {
    const lines = hiddenStagesRevealLines(
      [hiddenStage("Support", "unassigned", "empty", null)],
      new Map(),
    );
    expect(lines).toEqual(["Support — unassigned"]);
  });
});
