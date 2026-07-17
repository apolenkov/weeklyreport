/**
 * Characterization + unit tests for the extracted cross-author mappers
 * (refactor-lead-mappers slice). The stage-map fixtures pin today's behavior
 * byte for byte, they are NOT idealized expectations. The foreign-content
 * mappers below (`mapForeignItems` / `mapForeignRisks` / `mapForeignDecisions`
 * / `coerceWorkflowToItemStatus`) are live — called from
 * `lead-form-loaded-view-model-helpers.ts` — and are asserted directly here.
 */

import { describe, expect, it } from "vitest";

import { workflowToItemStatus } from "./item-status";
import {
  applyCrossAuthorStageOverrides,
  buildCrossAuthorStageMap,
  coerceWorkflowToItemStatus,
  type CrossAuthorContentRow,
  type CrossAuthorRow,
  mapForeignDecisions,
  mapForeignItems,
  mapForeignRisks,
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

const AUTHOR_ID = "author-9";
const PROJECT_ID = "proj-x";

function makeContentRow(
  overrides: Partial<CrossAuthorContentRow> = {},
): CrossAuthorContentRow {
  return {
    authorId: AUTHOR_ID,
    authorName: "Baker Lee",
    items: [],
    risks: [],
    decisions: [],
    ...overrides,
  };
}

describe("mapForeignItems", () => {
  it("scopes ids as foreign:<authorId>:<itemId> and filters by item type", () => {
    const row = makeContentRow({
      items: [
        {
          id: "item-current",
          projectId: PROJECT_ID,
          type: "current",
          text: "Current work",
          workflowStatus: "planned",
          stageNames: [],
        },
        {
          id: "item-next",
          projectId: PROJECT_ID,
          type: "next",
          text: "Next work",
          workflowStatus: "planned",
          stageNames: [],
        },
      ],
    });

    const current = mapForeignItems([row], new Map(), "current");
    const next = mapForeignItems([row], new Map(), "next");

    expect(current).toHaveLength(1);
    expect(current[0]?.id).toBe(`foreign:${AUTHOR_ID}:item-current`);
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe(`foreign:${AUTHOR_ID}:item-next`);
  });

  it("falls back to the raw projectId as productName on a lookup miss", () => {
    const row = makeContentRow({
      items: [
        {
          id: "item-1",
          projectId: PROJECT_ID,
          type: "current",
          text: "Work",
          workflowStatus: "planned",
          stageNames: [],
        },
      ],
    });

    const [mapped] = mapForeignItems([row], new Map(), "current");

    expect(mapped.productName).toBe(PROJECT_ID);
  });

  it("uses the productNameById lookup when it hits", () => {
    const row = makeContentRow({
      items: [
        {
          id: "item-1",
          projectId: PROJECT_ID,
          type: "current",
          text: "Work",
          workflowStatus: "planned",
          stageNames: [],
        },
      ],
    });

    const [mapped] = mapForeignItems(
      [row],
      new Map([[PROJECT_ID, "Alpha Product"]]),
      "current",
    );

    expect(mapped.productName).toBe("Alpha Product");
  });

  it("applies the author's own covering blocked risk as the blocked overlay", () => {
    const row = makeContentRow({
      items: [
        {
          id: "item-1",
          projectId: PROJECT_ID,
          type: "current",
          text: "In-flight work",
          workflowStatus: "in_progress",
          stageNames: [],
        },
      ],
      risks: [
        {
          id: "risk-1",
          projectId: PROJECT_ID,
          risk: "Vendor outage",
          impact: "Delivery slips",
          mitigation: "Failover plan",
          severity: "blocked",
          stageNames: [],
        },
      ],
    });

    const [mapped] = mapForeignItems([row], new Map(), "current");

    expect(mapped.status).toBe("blocked");
  });

  it("does not apply the overlay when no covering risk exists", () => {
    const row = makeContentRow({
      items: [
        {
          id: "item-1",
          projectId: PROJECT_ID,
          type: "current",
          text: "In-flight work",
          workflowStatus: "in_progress",
          stageNames: [],
        },
      ],
    });

    const [mapped] = mapForeignItems([row], new Map(), "current");

    expect(mapped.status).toBe("in-progress");
  });
});

describe("mapForeignRisks", () => {
  it("scopes ids as foreign:<authorId>:<riskId> and passes severity through unchanged", () => {
    const row = makeContentRow({
      risks: [
        {
          id: "risk-1",
          projectId: PROJECT_ID,
          risk: "Vendor outage",
          impact: "Delivery slips",
          mitigation: "Failover plan",
          severity: "at-risk",
          stageNames: [],
        },
        {
          id: "risk-2",
          projectId: PROJECT_ID,
          risk: "Data loss",
          impact: "Compliance",
          mitigation: "Backups",
          severity: "blocked",
          stageNames: [],
        },
      ],
    });

    const mapped = mapForeignRisks([row], new Map());

    expect(mapped[0]?.id).toBe(`foreign:${AUTHOR_ID}:risk-1`);
    expect(mapped[0]?.severity).toBe("at-risk");
    expect(mapped[1]?.id).toBe(`foreign:${AUTHOR_ID}:risk-2`);
    expect(mapped[1]?.severity).toBe("blocked");
  });
});

describe("mapForeignDecisions", () => {
  it("scopes ids as foreign:<authorId>:<decisionId> and formats a present deadline to its ISO date prefix", () => {
    const row = makeContentRow({
      decisions: [
        {
          id: "decision-1",
          productId: PROJECT_ID,
          text: "Choose vendor",
          owner: "Baker Lee",
          impact: "Cost",
          deadline: new Date("2026-08-01T15:30:00.000Z"),
          stageNames: [],
        },
      ],
    });

    const [mapped] = mapForeignDecisions([row], new Map());

    expect(mapped.id).toBe(`foreign:${AUTHOR_ID}:decision-1`);
    expect(mapped.deadline).toBe("2026-08-01");
  });

  it("passes a null deadline through as null", () => {
    const row = makeContentRow({
      decisions: [
        {
          id: "decision-1",
          productId: PROJECT_ID,
          text: "Choose vendor",
          owner: "Baker Lee",
          impact: "Cost",
          deadline: null,
          stageNames: [],
        },
      ],
    });

    const [mapped] = mapForeignDecisions([row], new Map());

    expect(mapped.deadline).toBeNull();
  });
});

describe("coerceWorkflowToItemStatus", () => {
  it.each([
    ["done", workflowToItemStatus("done")],
    ["in_progress", workflowToItemStatus("in_progress")],
    ["paused", workflowToItemStatus("paused")],
    ["postponed", workflowToItemStatus("postponed")],
    ["planned", workflowToItemStatus("planned")],
  ] as const)(
    "delegates known workflow value %s to workflowToItemStatus",
    (ws, expected) => {
      expect(coerceWorkflowToItemStatus(ws)).toBe(expected);
    },
  );

  it("falls back to 'planned' for an unknown workflow string", () => {
    expect(coerceWorkflowToItemStatus("some-legacy-value")).toBe("planned");
  });
});
