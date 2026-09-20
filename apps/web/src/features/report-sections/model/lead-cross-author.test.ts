// Cross-author mapper tests cover server-provided stage and content rows.

import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  applyCrossAuthorStageOverrides,
  buildCrossAuthorStageMap,
  type CrossAuthorRow,
} from "./lead-cross-author";
import {
  type CrossAuthorContentRow,
  mapForeignDecisions,
  mapForeignItems,
  mapForeignRisks,
} from "./lead-cross-author-content";
import type { LeadProduct } from "./lead-form";

describe("buildCrossAuthorStageMap", () => {
  const crossAuthor: CrossAuthorRow = {
    projectId: "proj-a",
    authorId: "author-1",
    authorInitials: "BL",
    authorShortName: "Baker L.",
    stageNames: ["Development", "Testing"],
    stages: [
      { stageName: "Development", status: "green" },
      { stageName: "Testing", status: null },
    ],
  };

  it("keys stages by their exact canonical names", () => {
    const map = buildCrossAuthorStageMap([crossAuthor]);
    const stageMap = map.get("proj-a");
    expect(stageMap).toBeDefined();
    expect([...(stageMap?.keys() ?? [])]).toEqual(["Development", "Testing"]);
  });

  it("derives status from ca.stages traffic only — no section data", () => {
    const map = buildCrossAuthorStageMap([crossAuthor]);
    // Development: green traffic → on-track (no risks/items passed, so no override).
    expect(map.get("proj-a")?.get("Development")).toEqual({
      assignee: "Baker L.",
      status: "on-track",
    });
    // Testing: null traffic → empty.
    expect(map.get("proj-a")?.get("Testing")).toEqual({
      assignee: "Baker L.",
      status: "empty",
    });
  });

  it("derives 'empty' status when stage list is empty", () => {
    const map = buildCrossAuthorStageMap([{ ...crossAuthor, stages: [] }]);
    expect(map.get("proj-a")?.get("Development")).toEqual({
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
        { stageName: "Development", status: "yellow" },
        { stageName: "Testing", status: "red" },
      ],
    };
    const map = buildCrossAuthorStageMap([derived]);
    expect(map.get("proj-a")?.get("Development")).toEqual({
      assignee: "Baker L.",
      status: "at-risk",
    });
    expect(map.get("proj-a")?.get("Testing")).toEqual({
      assignee: "Baker L.",
      status: "blocked",
    });
  });
});

describe("applyCrossAuthorStageOverrides", () => {
  // Foreign-owned stages arrive locked with assignee null; the override fills
  // real assignee + status. Mine stays untouched; unmatched locked keeps null.
  const product: LeadProduct = {
    id: "proj-a",
    name: "Alpha Product",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Development",
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
        ["Development", { assignee: "Baker L.", status: "blocked" as const }],
        ["Testing", { assignee: "Baker L.", status: "at-risk" as const }],
        // no "support" entry — a locked stage with no cross-author match stays.
      ]),
    ],
  ]);

  it("fills foreign-owned (locked) stages from cross-author data, leaving mine and unmatched locked untouched", () => {
    const result = expectDefined(
      applyCrossAuthorStageOverrides([product], overrides)[0],
    );
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
const PRODUCT_NAMES = new Map([[PROJECT_ID, "Alpha Product"]]);

function makeContentRow(
  overrides: Partial<CrossAuthorContentRow> = {},
): CrossAuthorContentRow {
  return {
    authorId: AUTHOR_ID,
    authorName: "Baker Lee",
    authorRole: "lead",
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
          stageNames: ["Development"],
        },
        {
          id: "item-next",
          projectId: PROJECT_ID,
          type: "next",
          text: "Next work",
          workflowStatus: "planned",
          stageNames: ["Development"],
        },
      ],
    });

    const current = mapForeignItems([row], PRODUCT_NAMES, "current");
    const next = mapForeignItems([row], PRODUCT_NAMES, "next");

    expect(current).toHaveLength(1);
    expect(current[0]?.id).toBe(`foreign:${AUTHOR_ID}:item-current`);
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe(`foreign:${AUTHOR_ID}:item-next`);
  });

  it("fails loudly when a product name is missing", () => {
    const row = makeContentRow({
      items: [
        {
          id: "item-1",
          projectId: PROJECT_ID,
          type: "current",
          text: "Work",
          workflowStatus: "planned",
          stageNames: ["Development"],
        },
      ],
    });

    expect(() => mapForeignItems([row], new Map(), "current")).toThrow(
      `Cross-author product ${PROJECT_ID} has no display name.`,
    );
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
          stageNames: ["Development"],
        },
      ],
    });

    const mapped = expectDefined(
      mapForeignItems(
        [row],
        new Map([[PROJECT_ID, "Alpha Product"]]),
        "current",
      )[0],
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
          stageNames: ["Development"],
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
          stageNames: ["Development"],
        },
      ],
    });

    const mapped = expectDefined(
      mapForeignItems([row], PRODUCT_NAMES, "current")[0],
    );

    expect(mapped.status).toBe("blocked");
  });

  it("applies the author's own covering at-risk risk as the at-risk overlay", () => {
    const row = makeContentRow({
      items: [
        {
          id: "item-1",
          projectId: PROJECT_ID,
          type: "current",
          text: "In-flight work",
          workflowStatus: "in_progress",
          stageNames: ["Development"],
        },
      ],
      risks: [
        {
          id: "risk-1",
          projectId: PROJECT_ID,
          risk: "Vendor outage",
          impact: "Delivery slips",
          mitigation: "Failover plan",
          severity: "at-risk",
          stageNames: ["Development"],
        },
      ],
    });

    const mapped = expectDefined(
      mapForeignItems([row], PRODUCT_NAMES, "current")[0],
    );

    expect(mapped.status).toBe("at-risk");
    expect(mapped.foreign).toBe(true);
    expect(mapped.authorId).toBe(AUTHOR_ID);
    expect(mapped.pausedReason).toBeNull();
    expect(mapped.priorityRank).toBeNull();
  });

  it("scopes the overlay to each author when product and stage are shared", () => {
    const sharedItem = {
      projectId: PROJECT_ID,
      type: "current" as const,
      workflowStatus: "in_progress" as const,
      stageNames: ["Development"],
    };
    const rows: CrossAuthorContentRow[] = [
      makeContentRow({
        authorId: "author-at-risk",
        items: [{ ...sharedItem, id: "item-at-risk", text: "Alice work" }],
        risks: [
          {
            id: "risk-at-risk",
            projectId: PROJECT_ID,
            risk: "Vendor outage",
            impact: "Delivery slips",
            mitigation: "Failover plan",
            severity: "at-risk",
            stageNames: ["Development"],
          },
        ],
      }),
      makeContentRow({
        authorId: "author-clear",
        items: [{ ...sharedItem, id: "item-clear", text: "Bob work" }],
      }),
    ];

    const mapped = mapForeignItems(rows, PRODUCT_NAMES, "current");

    expect(mapped).toHaveLength(2);
    expect(mapped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "foreign:author-at-risk:item-at-risk",
          status: "at-risk",
        }),
        expect.objectContaining({
          id: "foreign:author-clear:item-clear",
          status: "in-progress",
        }),
      ]),
    );
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
          stageNames: ["Development"],
        },
      ],
    });

    const mapped = expectDefined(
      mapForeignItems([row], PRODUCT_NAMES, "current")[0],
    );

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
          stageNames: ["Development"],
        },
        {
          id: "risk-2",
          projectId: PROJECT_ID,
          risk: "Data loss",
          impact: "Compliance",
          mitigation: "Backups",
          severity: "blocked",
          stageNames: ["Development"],
        },
      ],
    });

    const mapped = mapForeignRisks([row], PRODUCT_NAMES);

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
          stageNames: ["Development"],
        },
      ],
    });

    const mapped = expectDefined(mapForeignDecisions([row], PRODUCT_NAMES)[0]);

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
          stageNames: ["Development"],
        },
      ],
    });

    const mapped = expectDefined(mapForeignDecisions([row], PRODUCT_NAMES)[0]);

    expect(mapped.deadline).toBeNull();
  });
});
