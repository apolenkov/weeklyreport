import { mapPrismaToReportSection } from "@customreport/report-persistence";
import { publishedReportSnapshotSchema } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { assertAssistantReadiness } from "./seed-assistant-readiness.js";

const ACTOR_ID = "a0000000-0000-4000-8000-000000000011";
const FOREIGN_AUTHOR_ID = "a0000000-0000-4000-8000-000000000012";
const GROUP_ID = "a0000000-0000-4000-8000-000000000301";
const PRODUCT_ID = "a0000000-0000-4000-8000-000000000201";
const STAGE_ID = "a0000000-0000-4000-8000-000000000704";
const CURRENT_REPORT_ID = "a0000000-0000-4000-8000-000000000001";
const PUBLISHED_REPORT_ID = "a0000000-0000-4000-8000-000000000002";
const WRONG_CURRENT_REPORT_ID = "a0000000-0000-4000-8000-000000000006";
const CURRENT_SECTION_ID = "a0000000-0000-4000-8000-000000000401";
const PUBLISHED_SECTION_ID = "a0000000-0000-4000-8000-000000000402";
const ITEM_ID = "a0000000-0000-4000-8000-000000000501";
const FIXTURE_NOW = new Date("2026-09-20T00:00:00.000Z");

interface SourceRow {
  readonly id: string;
  readonly periodStart: Date;
  readonly status: "draft" | "published";
  readonly periodStatus: "open" | "published" | "reopened";
  readonly periodState: "open" | "published" | "archived";
  readonly weekLabel: string;
  readonly archived: boolean;
}

interface Store {
  readonly currentRows: readonly SourceRow[];
  readonly publishedRows: readonly SourceRow[];
  readonly snapshots: ReadonlyMap<string, unknown>;
  readonly liveSections: ReadonlyMap<string, readonly unknown[]>;
  readonly ownSectionReportIds: readonly string[];
  readonly sharedProductIdsByAuthor: ReadonlyMap<string, readonly string[]>;
}

const sourceRows = (): Pick<Store, "currentRows" | "publishedRows"> => ({
  currentRows: [
    {
      id: CURRENT_REPORT_ID,
      periodStart: new Date("2026-09-14T00:00:00.000Z"),
      status: "draft",
      periodStatus: "open",
      periodState: "open",
      weekLabel: "Week 38",
      archived: false,
    },
  ],
  publishedRows: [
    {
      id: PUBLISHED_REPORT_ID,
      periodStart: new Date("2026-09-07T00:00:00.000Z"),
      status: "published",
      periodStatus: "published",
      periodState: "published",
      weekLabel: "Week 37",
      archived: false,
    },
  ],
});

function liveSectionRow(
  reportId: string,
  sectionId: string,
  authorId = ACTOR_ID,
  duplicateItem = false,
): Record<string, unknown> {
  const stage = { id: STAGE_ID, name: "Development", sortOrder: 0 };
  const project = {
    id: PRODUCT_ID,
    name: "Marketing Portal",
    archived: false,
    stageAssignments: [{ userId: authorId, stageId: STAGE_ID, stage }],
    groupProducts: [{ groupId: GROUP_ID }],
    lead: { reportingGroupId: GROUP_ID },
  };
  const item = {
    id: ITEM_ID,
    stableId: ITEM_ID,
    projectId: PRODUCT_ID,
    activityId: null,
    type: "current",
    text: "Ship the release",
    tag: "release",
    workflowStatus: "in_progress",
    carriedOver: false,
    priorityRank: null,
    pausedReason: null,
    nextStepText: null,
    resolution: null,
    stageNames: ["Development"],
    project: { name: project.name },
    recordComments: [],
  };
  return {
    id: sectionId,
    reportId,
    authorId,
    status: "submitted",
    submittedAt: null,
    late: false,
    version: 1,
    author: {
      id: authorId,
      name: authorId === ACTOR_ID ? "Primary Lead" : "Foreign Lead",
      role: "lead",
      reportingGroupId: GROUP_ID,
      stageAssignments: [
        {
          userId: authorId,
          stageId: STAGE_ID,
          projectId: PRODUCT_ID,
          project,
          stage,
        },
      ],
    },
    projectStatuses: [{ projectId: PRODUCT_ID, status: "green", project }],
    stageStatuses: [],
    items: duplicateItem ? [item, { ...item }] : [item],
    risks: [],
    decisions: [],
    activityStatuses: [],
    sectionReviews: [],
    itemOutcomeEvents: [],
  };
}

function publishedSnapshot(reportId: string): unknown {
  const row = liveSectionRow(
    reportId,
    reportId === PUBLISHED_REPORT_ID
      ? PUBLISHED_SECTION_ID
      : CURRENT_SECTION_ID,
  );
  const section = mapPrismaToReportSection(row as never);
  return JSON.parse(
    JSON.stringify(
      publishedReportSnapshotSchema.parse({
        reportId,
        periodStart: "2026-09-07",
        periodEnd: "2026-09-13",
        deadline: null,
        status: "published",
        publishedAt: "2026-09-13T23:59:59.000Z",
        publishedById: ACTOR_ID,
        publishedByName: "Head",
        portfolioOverview: {
          status: "green",
          totals: { green: 1, yellow: 0, red: 0 },
        },
        sections: [{ ...section, groupId: GROUP_ID, groupName: "Default" }],
      }),
    ),
  ) as unknown;
}

function validStore(overrides: Partial<Store> = {}): Store {
  const rows = sourceRows();
  return {
    ...rows,
    snapshots: new Map([
      [PUBLISHED_REPORT_ID, publishedSnapshot(PUBLISHED_REPORT_ID)],
    ]),
    liveSections: new Map([
      [
        CURRENT_REPORT_ID,
        [liveSectionRow(CURRENT_REPORT_ID, CURRENT_SECTION_ID)],
      ],
    ]),
    ownSectionReportIds: [CURRENT_REPORT_ID, PUBLISHED_REPORT_ID],
    sharedProductIdsByAuthor: new Map(),
    ...overrides,
  };
}

function queryId(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const where = (
    args as { where?: { id?: string | { in?: readonly string[] } } }
  ).where;
  return typeof where?.id === "string" ? where.id : where?.id?.in?.[0];
}

function selectsSnapshot(args: unknown): boolean {
  if (!args || typeof args !== "object") return false;
  return Boolean(
    (args as { select?: { publishedSnapshot?: boolean } }).select
      ?.publishedSnapshot,
  );
}

function fakePrisma(store: Store): unknown {
  const findMany = vi.fn((args: unknown) => {
    if (selectsSnapshot(args)) {
      return store.publishedRows.map((row) => ({
        ...row,
        id: row.id,
        publishedSnapshot: store.snapshots.get(row.id) ?? null,
      }));
    }
    if (
      args &&
      typeof args === "object" &&
      (args as { where?: { status?: string } }).where?.status === "published"
    ) {
      return store.publishedRows;
    }
    return store.currentRows;
  });
  const findUnique = vi.fn((args: unknown) => {
    const id = queryId(args);
    if (selectsSnapshot(args)) {
      return {
        publishedSnapshot: id ? (store.snapshots.get(id) ?? null) : null,
      };
    }
    return id ? { sections: store.liveSections.get(id) ?? [] } : null;
  });
  const transaction = vi.fn((callback: (tx: unknown) => unknown) =>
    Promise.resolve(
      callback({
        reportSection: {
          findMany: vi.fn(() =>
            store.ownSectionReportIds.map((reportId) => ({ reportId })),
          ),
        },
        stageAssignment: {
          findMany: vi.fn(() =>
            [...store.sharedProductIdsByAuthor].flatMap(
              ([userId, productIds]) =>
                productIds.map((projectId) => ({ userId, projectId })),
            ),
          ),
        },
      }),
    ),
  );
  return {
    report: { findMany, findUnique },
    semanticSourceState: {
      findUnique: vi.fn(() => ({ generation: 1n })),
    },
    $transaction: transaction,
  };
}

const options = {
  label: "seed-test",
  actorId: ACTOR_ID,
  expectedCurrentReportId: CURRENT_REPORT_ID,
  expectedPublishedReportIds: [PUBLISHED_REPORT_ID],
  now: FIXTURE_NOW,
};

async function expectReadinessFailure(
  store: Store,
  stage: string,
  reportId: string,
  readinessOptions = options,
): Promise<void> {
  await expect(
    assertAssistantReadiness(fakePrisma(store) as never, readinessOptions),
  ).rejects.toThrow(new RegExp(`${stage}.*${reportId}`));
}

describe("assistant seed readiness", () => {
  it("passes the primary lead through live mapping, authorization and projection", async () => {
    const digest = await assertAssistantReadiness(
      fakePrisma(validStore()) as never,
      options,
    );

    expect(digest.length).toBeGreaterThan(0);
    expect(digest).toEqual(
      [...digest].sort(
        (a, b) =>
          a.occurrenceId.localeCompare(b.occurrenceId) ||
          a.kind.localeCompare(b.kind),
      ),
    );
    expect(digest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          occurrenceId: expect.stringContaining(
            `${CURRENT_REPORT_ID}:`,
          ) as unknown,
          kind: "item",
        }),
        expect.objectContaining({
          occurrenceId: expect.stringContaining(
            `${PUBLISHED_REPORT_ID}:`,
          ) as unknown,
          kind: "item",
        }),
      ]),
    );
  });

  it("fails when the current source has no primary lead section", async () => {
    await expectReadinessFailure(
      validStore({
        liveSections: new Map([
          [
            CURRENT_REPORT_ID,
            [
              liveSectionRow(
                CURRENT_REPORT_ID,
                CURRENT_SECTION_ID,
                FOREIGN_AUTHOR_ID,
              ),
            ],
          ],
        ]),
      }),
      "current_primary",
      CURRENT_REPORT_ID,
    );
  });

  it("fails when the primary section has no projectable candidates", async () => {
    await expectReadinessFailure(
      validStore({
        liveSections: new Map([
          [
            CURRENT_REPORT_ID,
            (() => {
              const row = liveSectionRow(CURRENT_REPORT_ID, CURRENT_SECTION_ID);
              return [
                {
                  ...row,
                  author: {
                    ...(row.author as Record<string, unknown>),
                    stageAssignments: [],
                  },
                  projectStatuses: [],
                  stageStatuses: [],
                  items: [],
                },
              ];
            })(),
          ],
        ]),
      }),
      "current_candidates",
      CURRENT_REPORT_ID,
    );
  });

  it("does not fall back when a newer eligible current source is empty", async () => {
    const newerReportId = WRONG_CURRENT_REPORT_ID;
    await expectReadinessFailure(
      validStore({
        currentRows: [
          ...sourceRows().currentRows,
          {
            id: newerReportId,
            periodStart: new Date("2026-09-19T00:00:00.000Z"),
            status: "draft",
            periodStatus: "open",
            periodState: "open",
            weekLabel: "Week 39",
            archived: false,
          },
        ],
        liveSections: new Map([
          [
            CURRENT_REPORT_ID,
            [liveSectionRow(CURRENT_REPORT_ID, CURRENT_SECTION_ID)],
          ],
          [newerReportId, []],
        ]),
      }),
      "current_primary",
      newerReportId,
      { ...options, expectedCurrentReportId: newerReportId },
    );
  });

  it("rejects a selected current source that differs from the seed contract", async () => {
    await expectReadinessFailure(
      validStore(),
      "current_source",
      WRONG_CURRENT_REPORT_ID,
      { ...options, expectedCurrentReportId: WRONG_CURRENT_REPORT_ID },
    );
  });

  it.each([
    ["null", null],
    [
      "empty",
      {
        ...(publishedSnapshot(PUBLISHED_REPORT_ID) as Record<string, unknown>),
        sections: [],
      },
    ],
    ["invalid", { reportId: PUBLISHED_REPORT_ID, sections: "broken" }],
    [
      "mismatched",
      {
        ...(publishedSnapshot(PUBLISHED_REPORT_ID) as Record<string, unknown>),
        reportId: CURRENT_REPORT_ID,
      },
    ],
  ] as const)(
    "rejects %s published snapshot before live fallback",
    async (_name, snapshot) => {
      await expectReadinessFailure(
        validStore({ snapshots: new Map([[PUBLISHED_REPORT_ID, snapshot]]) }),
        "published_snapshot",
        PUBLISHED_REPORT_ID,
      );
    },
  );

  it("fails when the published primary section is unauthorized", async () => {
    await expectReadinessFailure(
      validStore({ ownSectionReportIds: [CURRENT_REPORT_ID] }),
      "authorization",
      PUBLISHED_REPORT_ID,
    );
  });

  it("fails when only a shared foreign section can produce candidates", async () => {
    await expectReadinessFailure(
      validStore({
        liveSections: new Map([
          [
            CURRENT_REPORT_ID,
            [
              liveSectionRow(
                CURRENT_REPORT_ID,
                CURRENT_SECTION_ID,
                FOREIGN_AUTHOR_ID,
              ),
            ],
          ],
        ]),
        ownSectionReportIds: [PUBLISHED_REPORT_ID],
        sharedProductIdsByAuthor: new Map([[FOREIGN_AUTHOR_ID, [PRODUCT_ID]]]),
      }),
      "current_primary",
      CURRENT_REPORT_ID,
    );
  });

  it("fails on duplicate projected occurrence identities", async () => {
    await expectReadinessFailure(
      validStore({
        liveSections: new Map([
          [
            CURRENT_REPORT_ID,
            [
              liveSectionRow(
                CURRENT_REPORT_ID,
                CURRENT_SECTION_ID,
                ACTOR_ID,
                true,
              ),
            ],
          ],
        ]),
      }),
      "identity",
      CURRENT_REPORT_ID,
    );
  });
});
