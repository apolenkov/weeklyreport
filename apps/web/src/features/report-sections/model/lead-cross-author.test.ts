/**
 * Characterization tests for the extracted cross-author mappers
 * (refactor-lead-mappers slice). Fixtures pin today's behavior byte for
 * byte, they are NOT idealized expectations.
 *
 * crossAuthorSections-based tests (mapForeignItems / mapForeignRisks /
 * mapForeignDecisions / coerceWorkflowToItemStatus) have been removed:
 * those mappers no longer exist — foreign-content reads were deleted as
 * part of the scope-lead-report-to-own-contribution change.
 */

import { describe, expect, it } from "vitest";

import {
  applyCrossAuthorStageOverrides,
  buildCrossAuthorStageMap,
  type CrossAuthorRow,
} from "./lead-cross-author";
import type { LeadProduct } from "./lead-form";

describe("buildCrossAuthorStageMap", () => {
  const crossAuthor: CrossAuthorRow = {
    projectId: "proj-a",
    authorId: "author-1",
    authorInitials: "BL",
    authorShortName: "Baker L.",
    stageNames: ["Development", "Testing"],
    stages: [
      { stageName: "Dev", status: "green" },
      { stageName: "Testing", status: null },
    ],
  };

  it("keys stages via normalizeStageName (Dev↔Development alias)", () => {
    const map = buildCrossAuthorStageMap([crossAuthor]);
    const stageMap = map.get("proj-a");
    expect(stageMap).toBeDefined();
    expect([...(stageMap?.keys() ?? [])]).toEqual(["dev", "testing"]);
  });

  it("derives status from ca.stages traffic only — no section data", () => {
    const map = buildCrossAuthorStageMap([crossAuthor]);
    // Dev: green traffic → on-track (no risks/items passed, so no override).
    expect(map.get("proj-a")?.get("dev")).toEqual({
      assignee: "Baker L.",
      status: "on-track",
    });
    // Testing: null traffic → empty.
    expect(map.get("proj-a")?.get("testing")).toEqual({
      assignee: "Baker L.",
      status: "empty",
    });
  });

  it("derives 'empty' status when stage list is empty", () => {
    const map = buildCrossAuthorStageMap([{ ...crossAuthor, stages: [] }]);
    expect(map.get("proj-a")?.get("dev")).toEqual({
      assignee: "Baker L.",
      status: "empty",
    });
  });

  it("trusts the server-derived traffic directly (red → blocked, yellow → at-risk)", () => {
    // The server already risk-derives ca.stages[].status
    // (deriveForeignStageStatus). The mapper must NOT re-derive it: a server
    // `red` is a covering blocked risk and must stay blocked, not collapse to
    // on-track. Re-deriving here would make the foreign chip green while
    // product health reads red — a self-contradictory screen.
    const derived: CrossAuthorRow = {
      ...crossAuthor,
      stageNames: ["Development", "Testing"],
      stages: [
        { stageName: "Dev", status: "yellow" },
        { stageName: "Testing", status: "red" },
      ],
    };
    const map = buildCrossAuthorStageMap([derived]);
    expect(map.get("proj-a")?.get("dev")).toEqual({
      assignee: "Baker L.",
      status: "at-risk",
    });
    expect(map.get("proj-a")?.get("testing")).toEqual({
      assignee: "Baker L.",
      status: "blocked",
    });
  });
});

describe("applyCrossAuthorStageOverrides", () => {
  // unassigned-stage-reporting-exclusion: foreign-owned stages now arrive as
  // `locked` with `assignee: null` straight from buildStageGrid; the override
  // fills the real assignee + status. Mine stays untouched; a locked stage with
  // no matching cross-author entry keeps its null assignee.
  const product: LeadProduct = {
    id: "proj-a",
    name: "Alpha Product",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Dev",
        status: "on-track",
        ownership: "mine",
        assignee: "Me",
      },
      {
        stageName: "Testing",
        status: "empty",
        ownership: "locked",
        assignee: null,
      },
      {
        stageName: "Support",
        status: "empty",
        ownership: "locked",
        assignee: null,
      },
    ],
  };

  const overrides = new Map([
    [
      "proj-a",
      new Map([
        ["dev", { assignee: "Baker L.", status: "blocked" as const }],
        ["testing", { assignee: "Baker L.", status: "at-risk" as const }],
        // no "support" entry — a locked stage with no cross-author match stays.
      ]),
    ],
  ]);

  it("fills foreign-owned (locked) stages from cross-author data, leaving mine and unmatched locked untouched", () => {
    const [result] = applyCrossAuthorStageOverrides([product], overrides);
    expect(result.stages).toEqual([
      // 'mine' untouched even though an override exists for "dev".
      product.stages[0],
      {
        stageName: "Testing",
        status: "at-risk",
        ownership: "locked",
        assignee: "Baker L.",
      },
      // locked with no matching override entry stays untouched (null assignee).
      product.stages[2],
    ]);
  });

  it("returns products untouched when no override entry matches", () => {
    const [result] = applyCrossAuthorStageOverrides([product], new Map());
    expect(result).toBe(product);
  });
});
