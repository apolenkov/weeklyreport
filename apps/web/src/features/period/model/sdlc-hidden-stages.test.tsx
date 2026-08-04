// @vitest-environment node
import type { TrafficLightStatus } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type { StageAssignment } from "../../report-sections";
import type { CrossAuthorEntry } from "./sdlc-cross-author";
import {
  foreignOwnersForProduct,
  hiddenStagesRevealLines,
} from "./sdlc-hidden-stages";

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
  status: TrafficLightStatus | null,
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
      [hiddenStage("DevOps", "locked", "empty", null)],
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
      [hiddenStage("DevOps", "locked", "empty", null)],
      foreignOwners,
    );
    expect(lines).toEqual(["DevOps — MK: blocked"]);
  });

  it("a foreign stage with no resolved owner reads '<stage> — another lead'", () => {
    // Hidden stages are foreign-owned; a locked stage whose owner has not been
    // resolved (Mine mode without cross-author data) still reads as owned.
    const lines = hiddenStagesRevealLines(
      [hiddenStage("Support", "locked", "empty", null)],
      new Map(),
    );
    expect(lines).toEqual(["Support — another lead"]);
    expect(lines[0]).not.toContain("unassigned");
  });
});
