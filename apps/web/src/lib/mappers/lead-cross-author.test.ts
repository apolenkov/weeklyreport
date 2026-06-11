/**
 * Characterization tests for the extracted cross-author mappers
 * (refactor-lead-mappers). Fixtures are transcribed from the previous
 * inline logic in `lead-form.tsx` — they pin today's behavior byte for
 * byte (design D5), they are NOT idealized expectations.
 */

import { describe, expect, it } from "vitest";

import { workflowToItemStatus } from "./item-status";
import {
  applyCrossAuthorStageOverrides,
  buildCrossAuthorStageMap,
  coerceWorkflowToItemStatus,
  type CrossAuthorRow,
  type CrossAuthorSection,
  mapForeignDecisions,
  mapForeignItems,
  mapForeignRisks,
} from "./lead-cross-author";
import type { LeadProduct } from "./lead-form";

const emptySection = (
  authorId: string,
  authorName: string,
): CrossAuthorSection => ({
  authorId,
  authorName,
  items: [],
  risks: [],
  decisions: [],
});

const baseSection: CrossAuthorSection = {
  authorId: "author-1",
  authorName: "Boris Leadov",
  items: [
    {
      id: "item-1",
      projectId: "proj-a",
      type: "current",
      text: "Ship the API",
      workflowStatus: "in_progress",
      stageNames: ["Dev"],
    },
    {
      id: "item-2",
      projectId: "proj-a",
      type: "next",
      text: "Write the docs",
      workflowStatus: "done",
      stageNames: ["Support"],
    },
    {
      id: "item-3",
      projectId: "proj-b",
      type: "current",
      text: "Unknown workflow",
      workflowStatus: "something_new",
      stageNames: [],
    },
  ],
  risks: [
    {
      id: "risk-1",
      projectId: "proj-a",
      risk: "DB migration is risky",
      impact: "Delay",
      mitigation: "Dry run",
      severity: "blocked",
      stageNames: ["Dev"],
    },
    {
      id: "risk-2",
      projectId: "proj-b",
      risk: "Vendor flaky",
      impact: "Minor",
      mitigation: "Retry",
      severity: "yellow-ish",
      stageNames: ["Testing"],
    },
  ],
  decisions: [
    {
      id: "dec-1",
      productId: "proj-a",
      text: "Adopt feature flags",
      owner: "Boris",
      impact: "Safer rollouts",
      deadline: new Date("2026-06-15T13:45:00.000Z"),
      stageNames: ["Planning"],
    },
    {
      id: "dec-2",
      productId: "proj-b",
      text: "Defer the rewrite",
      owner: "Boris",
      impact: "Focus",
      deadline: null,
      stageNames: [],
    },
  ],
};

const nameById = new Map([["proj-a", "Alpha Product"]]);

describe("coerceWorkflowToItemStatus", () => {
  it("delegates the three known enum values to workflowToItemStatus", () => {
    for (const ws of ["done", "in_progress", "blocked"] as const) {
      expect(coerceWorkflowToItemStatus(ws)).toBe(workflowToItemStatus(ws));
    }
  });

  it("falls back to 'planned' for any other string", () => {
    expect(coerceWorkflowToItemStatus("")).toBe("planned");
    expect(coerceWorkflowToItemStatus("cancelled")).toBe("planned");
    expect(coerceWorkflowToItemStatus("DONE")).toBe("planned");
  });
});

describe("mapForeignItems", () => {
  it("produces identical shapes for 'current' and 'next', differing only by the type filter", () => {
    const current = mapForeignItems([baseSection], nameById, "current");
    const next = mapForeignItems([baseSection], nameById, "next");
    expect(current.map((i) => i.id)).toEqual([
      "foreign:author-1:item-1",
      "foreign:author-1:item-3",
    ]);
    expect(next.map((i) => i.id)).toEqual(["foreign:author-1:item-2"]);
    expect(Object.keys(current[0] ?? {}).sort()).toEqual(
      Object.keys(next[0] ?? {}).sort(),
    );
  });

  it("maps fields verbatim: foreign id scheme, stageIds from stageNames, author from the section", () => {
    const [first] = mapForeignItems([baseSection], nameById, "current");
    expect(first).toEqual({
      id: "foreign:author-1:item-1",
      productId: "proj-a",
      productName: "Alpha Product",
      stageIds: ["Dev"],
      status: "in-progress",
      text: "Ship the API",
      author: "Boris Leadov",
      authorId: "author-1",
      foreign: true,
    });
  });

  it("falls back productName to the raw projectId when the lookup misses", () => {
    const items = mapForeignItems([baseSection], nameById, "current");
    expect(items[1]?.productName).toBe("proj-b");
  });

  it("coerces unknown workflow statuses to 'planned'", () => {
    const items = mapForeignItems([baseSection], nameById, "current");
    expect(items[1]?.status).toBe("planned");
  });

  it("returns [] for empty sections", () => {
    expect(mapForeignItems([], nameById, "current")).toEqual([]);
  });
});

describe("mapForeignRisks", () => {
  it("coerces every non-'blocked' severity to 'at-risk'", () => {
    const risks = mapForeignRisks([baseSection], nameById);
    expect(risks.map((r) => r.severity)).toEqual(["blocked", "at-risk"]);
  });

  it("maps fields verbatim with the foreign id scheme and authorName", () => {
    const [first] = mapForeignRisks([baseSection], nameById);
    expect(first).toEqual({
      id: "foreign:author-1:risk-1",
      productId: "proj-a",
      productName: "Alpha Product",
      stageIds: ["Dev"],
      severity: "blocked",
      text: "DB migration is risky",
      impact: "Delay",
      mitigation: "Dry run",
      authorName: "Boris Leadov",
      authorId: "author-1",
      foreign: true,
    });
  });
});

describe("mapForeignDecisions", () => {
  it("formats a Date deadline to the yyyy-mm-dd ISO prefix", () => {
    const [first] = mapForeignDecisions([baseSection], nameById);
    expect(first.deadline).toBe("2026-06-15");
  });

  it("passes a null deadline through", () => {
    const decisions = mapForeignDecisions([baseSection], nameById);
    expect(decisions[1]?.deadline).toBeNull();
  });

  it("maps fields verbatim with the foreign id scheme", () => {
    const [first] = mapForeignDecisions([baseSection], nameById);
    expect(first).toEqual({
      id: "foreign:author-1:dec-1",
      productId: "proj-a",
      productName: "Alpha Product",
      text: "Adopt feature flags",
      owner: "Boris",
      impact: "Safer rollouts",
      deadline: "2026-06-15",
      stageIds: ["Planning"],
      authorId: "author-1",
      foreign: true,
    });
  });
});

describe("buildCrossAuthorStageMap", () => {
  const crossAuthor: CrossAuthorRow = {
    projectId: "proj-a",
    authorId: "author-1",
    authorName: "Boris Leadov",
    stageNames: ["Development", "Testing"],
    stages: [
      { stageName: "Dev", status: "green" },
      { stageName: "Testing", status: null },
    ],
  };

  it("joins crossAuthors × sections by authorId and keys stages via normalizeStageName", () => {
    const map = buildCrossAuthorStageMap([crossAuthor], [baseSection]);
    const stageMap = map.get("proj-a");
    expect(stageMap).toBeDefined();
    // "Development" normalizes to "dev"; the join matched the "Dev" stage entry.
    expect([...(stageMap?.keys() ?? [])]).toEqual(["dev", "testing"]);
  });

  it("derives status from explicit traffic plus the author's stage-scoped risks and items", () => {
    const map = buildCrossAuthorStageMap([crossAuthor], [baseSection]);
    // Dev: green ("on-track") but risk-1 (severity "blocked") sits on proj-a/Dev.
    expect(map.get("proj-a")?.get("dev")).toEqual({
      assignee: "Boris Leadov",
      status: "blocked",
    });
    // Testing: null traffic ("empty"); risk-2 is on proj-b, so it does not apply.
    expect(map.get("proj-a")?.get("testing")).toEqual({
      assignee: "Boris Leadov",
      status: "empty",
    });
  });

  it("derives 'empty' status when the author has no section data", () => {
    const map = buildCrossAuthorStageMap(
      [{ ...crossAuthor, stages: [] }],
      [emptySection("other-author", "Nobody")],
    );
    expect(map.get("proj-a")?.get("dev")).toEqual({
      assignee: "Boris Leadov",
      status: "empty",
    });
  });
});

describe("applyCrossAuthorStageOverrides", () => {
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
        ownership: "unassigned",
        assignee: null,
      },
      {
        stageName: "Support",
        status: "empty",
        ownership: "locked",
        assignee: "Someone",
      },
    ],
  };

  const overrides = new Map([
    [
      "proj-a",
      new Map([
        ["dev", { assignee: "Boris Leadov", status: "blocked" as const }],
        ["testing", { assignee: "Boris Leadov", status: "at-risk" as const }],
        ["support", { assignee: "Boris Leadov", status: "on-track" as const }],
      ]),
    ],
  ]);

  it("rewrites ONLY 'unassigned' stages to 'locked' with assignee and status", () => {
    const [result] = applyCrossAuthorStageOverrides([product], overrides);
    expect(result.stages).toEqual([
      // 'mine' untouched even though an override exists for "dev".
      product.stages[0],
      {
        stageName: "Testing",
        status: "at-risk",
        ownership: "locked",
        assignee: "Boris Leadov",
      },
      // already-'locked' untouched.
      product.stages[2],
    ]);
  });

  it("returns products untouched when no override entry matches", () => {
    const [result] = applyCrossAuthorStageOverrides([product], new Map());
    expect(result).toBe(product);
  });
});
