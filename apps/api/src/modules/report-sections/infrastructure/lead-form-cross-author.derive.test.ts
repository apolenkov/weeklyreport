// Characterization pins for the cross-author derive helpers behind
// getCrossAuthors / getCrossAuthorContent: grouping, display forms, risk-derived
// stage precedence, shared-product scoping, and severity narrowing.
import { requirePublishedSnapshot } from "@weeklyreport/report-persistence";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import {
  buildCrossAuthorStatusRows,
  deriveForeignStageStatus,
  indexForeignSections,
} from "./lead-form-cross-author.derive";
import { fetchForeignContentSections } from "./lead-form-cross-author.fetch";
import {
  getPublishedCrossAuthorContent,
  getPublishedSharedNonArchivedProductIds,
} from "./lead-form-cross-author.query";
import {
  buildCrossAuthorContentRows,
  groupCrossAuthorAuthors,
} from "./lead-form-cross-author-content.derive";

const AUTHOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AUTHOR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT_1 = "11111111-1111-4111-8111-111111111111";
const PROJECT_2 = "22222222-2222-4222-8222-222222222222";
const STAGE_DEV = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const STAGE_TEST = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function frozenCrossAuthorSnapshot() {
  const section = (authorId: string, projectId: string) => ({
    reportSectionId: `${authorId.slice(0, 8)}-0000-4000-8000-000000000001`,
    reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    authorId,
    authorName: authorId === AUTHOR_A ? "Viewer" : "Foreign",
    authorRole: "lead" as const,
    version: 1,
    status: "submitted" as const,
    submittedAt: null,
    late: false,
    projects: [
      {
        projectId,
        projectName: "Frozen product",
        trafficLight: null,
        ownedStages: [
          authorId === AUTHOR_A
            ? { stageId: STAGE_TEST, stageName: "Test", sortOrder: 2 }
            : { stageId: STAGE_DEV, stageName: "Dev", sortOrder: 1 },
        ],
        stageSet: [
          { stageId: STAGE_DEV, stageName: "Dev", sortOrder: 1 },
          { stageId: STAGE_TEST, stageName: "Test", sortOrder: 2 },
        ],
        ownerGroupId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      },
    ],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
    groupId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    groupName: "Frozen group",
  });
  return requirePublishedSnapshot({
    reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    periodStart: "2026-05-04T00:00:00.000Z",
    periodEnd: "2026-05-10T00:00:00.000Z",
    deadline: null,
    status: "published" as const,
    publishedAt: "2026-05-10T00:00:00.000Z",
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green" as const,
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: [section(AUTHOR_A, PROJECT_1), section(AUTHOR_B, PROJECT_1)],
  });
}

describe("fetchForeignContentSections", () => {
  it("orders every nested record collection by durable identity", async () => {
    interface ForeignContentQueryArgs {
      readonly select: {
        readonly items: { readonly orderBy?: unknown };
        readonly risks: { readonly orderBy?: unknown };
        readonly decisions: { readonly orderBy?: unknown };
      };
    }
    const findMany = vi.fn<
      (args: ForeignContentQueryArgs) => Promise<readonly unknown[]>
    >(() => Promise.resolve([]));
    const prisma = {
      reportSection: { findMany },
    } as unknown as PrismaService;

    await fetchForeignContentSections(prisma, "report-id", ["author-id"]);

    const query = findMany.mock.calls[0]?.[0];
    expect(query?.select.items.orderBy).toEqual({ stableId: "asc" });
    expect(query?.select.risks.orderBy).toEqual({ stableId: "asc" });
    expect(query?.select.decisions.orderBy).toEqual({ stableId: "asc" });
  });
});

describe("published cross-author frozen projections", () => {
  it("repeated shared-product projection uses the same frozen input", () => {
    const snapshot = frozenCrossAuthorSnapshot();
    const firstIds = getPublishedSharedNonArchivedProductIds(
      snapshot,
      AUTHOR_A,
      AUTHOR_B,
    );
    // This projection receives the frozen snapshot, with no live query seam.
    const secondIds = getPublishedSharedNonArchivedProductIds(
      snapshot,
      AUTHOR_A,
      AUTHOR_B,
    );
    expect(secondIds).toEqual(firstIds);
    expect(
      getPublishedCrossAuthorContent(snapshot, AUTHOR_A).rows,
    ).toHaveLength(1);
  });

  it("repeated content projection is stable for the same frozen input", () => {
    const snapshot = frozenCrossAuthorSnapshot();
    const firstContent = getPublishedCrossAuthorContent(snapshot, AUTHOR_A);
    // Repeating a pure projection checks result stability, not concurrent writes.
    const secondContent = getPublishedCrossAuthorContent(snapshot, AUTHOR_A);
    expect(secondContent).toEqual(firstContent);
    expect(secondContent.coOwnsShared).toBe(true);
  });

  it("shared product identifiers agree with the content projection", () => {
    const snapshot = frozenCrossAuthorSnapshot();
    const frozenIds = getPublishedSharedNonArchivedProductIds(
      snapshot,
      AUTHOR_A,
      AUTHOR_B,
    );
    const result = getPublishedCrossAuthorContent(snapshot, AUTHOR_A);
    expect(frozenIds).toEqual([PROJECT_1]);
    expect(result.rows[0]?.sharedProductIds).toEqual(frozenIds);
  });
});

describe("deriveForeignStageStatus", () => {
  const dev = "Development";

  it("returns red when a blocked risk names the stage", () => {
    expect(
      deriveForeignStageStatus(
        dev,
        PROJECT_1,
        [{ projectId: PROJECT_1, severity: "blocked", stageNames: [dev] }],
        null,
      ),
    ).toBe("red");
  });

  it("returns yellow for any non-blocked covering severity", () => {
    expect(
      deriveForeignStageStatus(
        dev,
        PROJECT_1,
        [{ projectId: PROJECT_1, severity: "at-risk", stageNames: [dev] }],
        "green",
      ),
    ).toBe("yellow");
  });

  it("does not treat an empty product stage set as a wildcard", () => {
    expect(
      deriveForeignStageStatus(
        dev,
        PROJECT_1,
        [{ projectId: PROJECT_1, severity: "blocked", stageNames: [] }],
        "green",
      ),
    ).toBe("green");
  });

  it("blocked wins over at-risk within the named stage set", () => {
    expect(
      deriveForeignStageStatus(
        dev,
        PROJECT_1,
        [
          { projectId: PROJECT_1, severity: "at-risk", stageNames: [dev] },
          { projectId: PROJECT_1, severity: "blocked", stageNames: [dev] },
        ],
        null,
      ),
    ).toBe("red");
  });

  it("ignores a risk whose projectId does not match", () => {
    expect(
      deriveForeignStageStatus(
        dev,
        PROJECT_1,
        [{ projectId: PROJECT_2, severity: "blocked", stageNames: [dev] }],
        "green",
      ),
    ).toBe("green");
  });

  it("ignores a named risk that does not exactly name this stage", () => {
    expect(
      deriveForeignStageStatus(
        dev,
        PROJECT_1,
        [
          {
            projectId: PROJECT_1,
            severity: "blocked",
            stageNames: ["Testing"],
          },
        ],
        null,
      ),
    ).toBeNull();
  });

  it("matches the canonical Development stage name", () => {
    expect(
      deriveForeignStageStatus(
        dev,
        PROJECT_1,
        [{ projectId: PROJECT_1, severity: "blocked", stageNames: [dev] }],
        null,
      ),
    ).toBe("red");
  });

  it("collapses a persisted non-null status to green when no risk covers", () => {
    expect(deriveForeignStageStatus(dev, PROJECT_1, [], "red")).toBe("green");
  });

  it("stays null when persisted is null and no risk covers", () => {
    expect(deriveForeignStageStatus(dev, PROJECT_1, [], null)).toBeNull();
  });

  it("rejects an unknown covering severity instead of classifying it as at-risk", () => {
    expect(() =>
      deriveForeignStageStatus(
        dev,
        PROJECT_1,
        [{ projectId: PROJECT_1, severity: "unknown", stageNames: [dev] }],
        null,
      ),
    ).toThrow();
  });
});

describe("indexForeignSections", () => {
  it("keys non-null stage statuses by authorId::projectId::stageId and drops nulls", () => {
    const { statusMap, risksByAuthor } = indexForeignSections([
      {
        authorId: AUTHOR_A,
        risks: [
          {
            projectId: PROJECT_1,
            severity: "at-risk",
            stageNames: ["Development"],
          },
        ],
        stageStatuses: [
          { projectId: PROJECT_1, stageId: STAGE_DEV, status: "green" },
          { projectId: PROJECT_1, stageId: STAGE_TEST, status: null },
        ],
      },
    ]);

    expect(statusMap.get(`${AUTHOR_A}::${PROJECT_1}::${STAGE_DEV}`)).toBe(
      "green",
    );
    expect(statusMap.has(`${AUTHOR_A}::${PROJECT_1}::${STAGE_TEST}`)).toBe(
      false,
    );
    expect(risksByAuthor.get(AUTHOR_A)).toEqual([
      {
        projectId: PROJECT_1,
        severity: "at-risk",
        stageNames: ["Development"],
      },
    ]);
  });
});

describe("buildCrossAuthorStatusRows", () => {
  it("groups by (projectId, authorId) preserving first-seen order and dedups stageNames", () => {
    const others = [
      {
        projectId: PROJECT_1,
        stageId: STAGE_DEV,
        project: { id: PROJECT_1, name: "Alpha", archived: false },
        stage: { name: "Development" },
        user: { id: AUTHOR_A, name: "Иванов Пётр Сергеевич" },
      },
      {
        projectId: PROJECT_1,
        stageId: STAGE_TEST,
        project: { id: PROJECT_1, name: "Alpha", archived: false },
        stage: { name: "Testing" },
        user: { id: AUTHOR_A, name: "Иванов Пётр Сергеевич" },
      },
    ];
    const rows = buildCrossAuthorStatusRows(others, new Map(), new Map());

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      projectId: PROJECT_1,
      projectName: "Alpha",
      authorId: AUTHOR_A,
      authorInitials: "ИП",
      authorShortName: "Иванов П.С.",
      stageNames: ["Development", "Testing"],
      stages: [
        { stageName: "Development", status: null },
        { stageName: "Testing", status: null },
      ],
    });
  });

  it("drops archived-project rows entirely", () => {
    const rows = buildCrossAuthorStatusRows(
      [
        {
          projectId: PROJECT_1,
          stageId: STAGE_DEV,
          project: { id: PROJECT_1, name: "Alpha", archived: true },
          stage: { name: "Development" },
          user: { id: AUTHOR_A, name: "Иванов Пётр Сергеевич" },
        },
      ],
      new Map(),
      new Map(),
    );
    expect(rows).toEqual([]);
  });

  it("applies persisted status and covering risks per stage", () => {
    const { statusMap, risksByAuthor } = indexForeignSections([
      {
        authorId: AUTHOR_A,
        risks: [
          {
            projectId: PROJECT_1,
            severity: "blocked",
            stageNames: ["Testing"],
          },
        ],
        stageStatuses: [
          { projectId: PROJECT_1, stageId: STAGE_DEV, status: "yellow" },
        ],
      },
    ]);
    const others = [
      {
        projectId: PROJECT_1,
        stageId: STAGE_DEV,
        project: { id: PROJECT_1, name: "Alpha", archived: false },
        stage: { name: "Development" },
        user: { id: AUTHOR_A, name: "Иванов Пётр" },
      },
      {
        projectId: PROJECT_1,
        stageId: STAGE_TEST,
        project: { id: PROJECT_1, name: "Alpha", archived: false },
        stage: { name: "Testing" },
        user: { id: AUTHOR_A, name: "Иванов Пётр" },
      },
    ];
    const rows = buildCrossAuthorStatusRows(others, statusMap, risksByAuthor);

    // Development: no covering risk, persisted yellow -> green.
    // Testing: covering blocked risk -> red.
    expect(rows[0]?.stages).toEqual([
      { stageName: "Development", status: "green" },
      { stageName: "Testing", status: "red" },
    ]);
  });

  it("keeps distinct (projectId, authorId) groups in first-seen order", () => {
    const others = [
      {
        projectId: PROJECT_2,
        stageId: STAGE_DEV,
        project: { id: PROJECT_2, name: "Beta", archived: false },
        stage: { name: "Development" },
        user: { id: AUTHOR_B, name: "Петров Иван" },
      },
      {
        projectId: PROJECT_1,
        stageId: STAGE_DEV,
        project: { id: PROJECT_1, name: "Alpha", archived: false },
        stage: { name: "Development" },
        user: { id: AUTHOR_A, name: "Иванов Пётр" },
      },
    ];
    const rows = buildCrossAuthorStatusRows(others, new Map(), new Map());
    expect(rows.map((r) => `${r.projectId}:${r.authorId}`)).toEqual([
      `${PROJECT_2}:${AUTHOR_B}`,
      `${PROJECT_1}:${AUTHOR_A}`,
    ]);
  });
});

describe("groupCrossAuthorAuthors", () => {
  it("groups assignments per author preserving order, flags coOwnsShared", () => {
    const others = [
      {
        projectId: PROJECT_1,
        stageId: STAGE_DEV,
        stage: { name: "Development" },
        user: { id: AUTHOR_A, name: "Иванов Пётр", role: "lead" as const },
      },
      {
        projectId: PROJECT_2,
        stageId: STAGE_TEST,
        stage: { name: "Testing" },
        user: { id: AUTHOR_A, name: "Иванов Пётр", role: "lead" as const },
      },
    ];
    const { authorEntries, coOwnsShared, otherUserIds } =
      groupCrossAuthorAuthors(others);

    expect(coOwnsShared).toBe(true);
    expect(otherUserIds).toEqual([AUTHOR_A]);
    const entry = authorEntries.get(AUTHOR_A);
    expect([...(entry?.sharedProjectIds ?? [])]).toEqual([
      PROJECT_1,
      PROJECT_2,
    ]);
    expect(entry?.stageAssignments).toEqual([
      { projectId: PROJECT_1, stageId: STAGE_DEV, stageName: "Development" },
      { projectId: PROJECT_2, stageId: STAGE_TEST, stageName: "Testing" },
    ]);
  });

  it("reports coOwnsShared=false and empty ids for no assignments", () => {
    const { authorEntries, coOwnsShared, otherUserIds } =
      groupCrossAuthorAuthors([]);
    expect(coOwnsShared).toBe(false);
    expect(otherUserIds).toEqual([]);
    expect(authorEntries.size).toBe(0);
  });
});

describe("buildCrossAuthorContentRows", () => {
  const authorEntries = new Map([
    [
      AUTHOR_A,
      {
        authorId: AUTHOR_A,
        authorName: "Иванов Пётр",
        authorRole: "lead" as const,
        sharedProjectIds: new Set([PROJECT_1]),
        stageAssignments: [
          {
            projectId: PROJECT_1,
            stageId: STAGE_DEV,
            stageName: "Development",
          },
        ],
      },
    ],
  ]);

  it("scopes records to shared products, drops null-FK activity rows, narrows severity", () => {
    const rows = buildCrossAuthorContentRows(
      [
        {
          authorId: AUTHOR_A,
          items: [
            {
              id: "i1",
              projectId: PROJECT_1,
              type: "current",
              text: "shared item",
              tag: "feature",
              workflowStatus: "in_progress",
              carriedOver: false,
              priorityRank: null,
              stageNames: ["Development"],
            },
            {
              id: "i2",
              projectId: PROJECT_2,
              type: "current",
              text: "non-shared item",
              tag: "feature",
              workflowStatus: "in_progress",
              carriedOver: false,
              priorityRank: null,
              stageNames: ["Development"],
            },
            {
              id: "i3",
              projectId: null,
              type: "current",
              text: "activity item",
              tag: "feature",
              workflowStatus: "in_progress",
              carriedOver: false,
              priorityRank: null,
              stageNames: [],
            },
          ],
          risks: [
            {
              id: "r1",
              projectId: PROJECT_1,
              risk: "risk",
              impact: "impact",
              mitigation: "mit",
              severity: "blocked",
              stageNames: ["Development"],
            },
          ],
          decisions: [
            {
              id: "d1",
              productId: PROJECT_1,
              text: "dec",
              owner: "own",
              deadline: null,
              impact: "imp",
              resolvedAt: null,
              stageNames: ["Development"],
            },
            {
              id: "d2",
              productId: null,
              text: "activity decision",
              owner: "own",
              deadline: null,
              impact: "imp",
              resolvedAt: null,
              stageNames: [],
            },
          ],
          stageStatuses: [
            { projectId: PROJECT_1, stageId: STAGE_DEV, status: "green" },
          ],
        },
      ],
      authorEntries,
    );

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row?.sharedProductIds).toEqual([PROJECT_1]);
    expect(row?.items.map((i) => i.id)).toEqual(["i1"]);
    expect(row?.risks.map((r) => r.id)).toEqual(["r1"]);
    expect(row?.risks[0]?.severity).toBe("blocked");
    expect(row?.decisions.map((d) => d.id)).toEqual(["d1"]);
    // Risk-derived stage chip: blocked risk on Development -> red.
    expect(row?.stages).toEqual([
      { projectId: PROJECT_1, stageName: "Development", status: "red" },
    ]);
  });

  it("skips a section whose author is not a co-owner", () => {
    const rows = buildCrossAuthorContentRows(
      [
        {
          authorId: AUTHOR_B,
          items: [],
          risks: [],
          decisions: [],
          stageStatuses: [],
        },
      ],
      authorEntries,
    );
    expect(rows).toEqual([]);
  });

  it("rejects an unknown stored workflow status instead of coercing it", () => {
    expect(() =>
      buildCrossAuthorContentRows(
        [
          {
            authorId: AUTHOR_A,
            items: [
              {
                id: "i-invalid",
                projectId: PROJECT_1,
                type: "current",
                text: "invalid item",
                tag: "feature",
                workflowStatus: "unknown",
                carriedOver: false,
                priorityRank: null,
                stageNames: ["Development"],
              },
            ],
            risks: [],
            decisions: [],
            stageStatuses: [],
          },
        ],
        authorEntries,
      ),
    ).toThrow();
  });

  it("uses persisted status as the empty/non-empty base when no risk covers", () => {
    const rows = buildCrossAuthorContentRows(
      [
        {
          authorId: AUTHOR_A,
          items: [],
          risks: [],
          decisions: [],
          stageStatuses: [
            { projectId: PROJECT_1, stageId: STAGE_DEV, status: "red" },
          ],
        },
      ],
      authorEntries,
    );
    // Persisted red with no backing risk collapses to green.
    expect(rows[0]?.stages).toEqual([
      { projectId: PROJECT_1, stageName: "Development", status: "green" },
    ]);
  });
});
