import { PublishedSnapshotIntegrityError } from "@customreport/report-persistence";
import { describe, expect, it, vi } from "vitest";

import { publishedSnapshotFixture } from "../../../test-utils/prisma-test-helper.js";
import { ReportSectionDomainError } from "../application/report-sections.contract.js";
import {
  baseRow,
  type FabricatedRow,
  fullProjectStatus,
  fullRisk,
  OWNED_PROJECT,
} from "./__tests__/report-sections-prisma-harness.js";
import {
  decodeMyHistoryCursor,
  queryMyHistoryPage,
} from "./report-sections.my-history-query.js";

const reportId = "a0000000-0000-4000-8000-000000000010";
const sectionId = "a0000000-0000-4000-8000-000000000011";
const authorId = "a0000000-0000-4000-8000-000000000001";

describe("queryMyHistoryPage", () => {
  it("reads published lead history from the immutable snapshot", async () => {
    const findManyLive = vi.fn().mockResolvedValue([]);
    const findManyPublished = vi.fn().mockResolvedValue([
      {
        id: reportId,
        archived: false,
        publishedSnapshot: publishedSnapshotFixture({
          reportId,
          periodStart: "2026-04-14",
          periodEnd: "2026-04-18",
          publishedAt: "2026-04-20T12:00:00.000Z",
          sectionOwners: [
            {
              reportSectionId: sectionId,
              authorId,
              authorName: "Test Lead",
              groupId: "a0000000-0000-4000-8000-000000000009",
              groupName: "Test Group",
            },
          ],
        }),
      },
    ]);
    const prisma = {
      reportSection: { findMany: findManyLive },
      report: { findMany: findManyPublished },
      $transaction: (operation: (tx: unknown) => unknown) =>
        Promise.resolve(
          operation({
            reportSection: { findMany: findManyLive },
            report: { findMany: findManyPublished },
          }),
        ),
    } as never;

    const rows = await queryMyHistoryPage(prisma, authorId, { limit: 20 });

    expect(rows.items).toHaveLength(1);
    expect(rows.items[0]).toMatchObject({
      sectionId,
      reportId,
      reportStatus: "published",
      reopened: false,
    });
    expect(findManyLive).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { authorId, report: { periodStatus: { not: "published" } } },
      }),
    );
    const publishedQuery: unknown = findManyPublished.mock.calls[0]?.[0];
    expect(publishedQuery).toMatchObject({
      where: {
        status: "published",
        periodStatus: "published",
        publishedSectionScopes: { some: { authorId } },
      },
      orderBy: [
        { periodStart: "desc" },
        { publishedAt: "desc" },
        { id: "desc" },
      ],
    });
  });

  it.each([
    ["the transaction snapshot contains live rows", "live"],
    ["the transaction snapshot contains published rows", "published"],
  ] as const)(
    "reads one repeatable-read snapshot when %s",
    async (_label, initialSource) => {
      const liveRows =
        initialSource === "live"
          ? [
              liveRow(
                sectionId,
                new Date("2026-04-14T00:00:00Z"),
                new Date("2026-04-14T12:00:00Z"),
              ),
            ]
          : [];
      const publishedRows =
        initialSource === "published"
          ? [
              publishedRow(
                reportId,
                "2026-04-14T00:00:00Z",
                "2026-04-14T12:00:00Z",
              ),
            ]
          : [];
      let transactionOptions: unknown;
      const transactionClient = {
        reportSection: {
          findMany: vi.fn(() => Promise.resolve(liveRows)),
        },
        report: {
          findMany: vi.fn(() => Promise.resolve(publishedRows)),
        },
      };
      const prisma = {
        $transaction: async (
          operation: (tx: typeof transactionClient) => Promise<unknown>,
          options: unknown,
        ) => {
          transactionOptions = options;
          return operation(transactionClient);
        },
      } as never;

      const result = await queryMyHistoryPage(prisma, authorId, { limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
      expect(transactionOptions).toEqual({ isolationLevel: "RepeatableRead" });
    },
  );

  it("counts a live product's traffic light after the covering-risk floor, as the report does", async () => {
    const at = new Date("2026-04-14T12:00:00Z");
    const greenStatus = [
      fullProjectStatus({ projectId: OWNED_PROJECT, status: "green" }),
    ];
    const blockedRisk = fullRisk({
      projectId: OWNED_PROJECT,
      severity: "blocked",
      stageNames: ["Development"],
      project: { name: "Owned Project" },
    });
    const prismaFor = (rows: unknown[]) => {
      const client = {
        reportSection: { findMany: vi.fn(() => Promise.resolve(rows)) },
        report: { findMany: vi.fn(() => Promise.resolve([])) },
      };
      return {
        $transaction: (operation: (tx: typeof client) => unknown) =>
          Promise.resolve(operation(client)),
      } as never;
    };
    const lights = async (overrides: Partial<FabricatedRow>) => {
      const result = await queryMyHistoryPage(
        prismaFor([liveRow(sectionId, at, at, overrides)]),
        authorId,
        { limit: 20 },
      );
      return result.items[0]?.trafficLights;
    };

    expect(await lights({ projectStatuses: greenStatus })).toEqual({
      green: 1,
      yellow: 0,
      red: 0,
    });
    expect(
      await lights({ projectStatuses: greenStatus, risks: [blockedRisk] }),
    ).toEqual({ green: 0, yellow: 0, red: 1 });
  });

  it("flags a live section of a reopened period as reopened", async () => {
    const at = new Date("2026-04-14T12:00:00Z");
    const open = liveRow(sectionId, at, at);
    const reopened = {
      ...open,
      id: "a0000000-0000-4000-8000-000000000013",
      report: { ...open.report, periodStatus: "reopened" },
    };
    const client = {
      reportSection: {
        findMany: vi.fn(() => Promise.resolve([open, reopened])),
      },
      report: { findMany: vi.fn(() => Promise.resolve([])) },
    };
    const prisma = {
      $transaction: (operation: (tx: typeof client) => unknown) =>
        Promise.resolve(operation(client)),
    } as never;

    const { items } = await queryMyHistoryPage(prisma, authorId, {
      limit: 20,
    });

    expect(
      Object.fromEntries(items.map((e) => [e.sectionId, e.reopened])),
    ).toEqual({ [sectionId]: false, [reopened.id]: true });
  });

  it.each([
    ["a schema-invalid payload", { reportId }],
    [
      "a snapshot bound to a different report",
      publishedSnapshotFixture({
        reportId: "a0000000-0000-4000-8000-000000000099",
        periodStart: "2026-04-14",
        periodEnd: "2026-04-18",
        publishedAt: "2026-04-20T12:00:00.000Z",
        sectionOwners: [
          {
            reportSectionId: sectionId,
            authorId,
            authorName: "Test Lead",
            groupId: "a0000000-0000-4000-8000-000000000009",
            groupName: "Test Group",
          },
        ],
      }),
    ],
  ])(
    "fails the merged page on %s without a mutable fallback",
    async (_label, publishedSnapshot) => {
      const findManyLive = vi
        .fn()
        .mockResolvedValue([
          liveRow(
            sectionId,
            new Date("2026-04-14T00:00:00Z"),
            new Date("2026-04-14T12:00:00Z"),
          ),
        ]);
      const findManyPublished = vi
        .fn()
        .mockResolvedValue([
          { id: reportId, archived: false, publishedSnapshot },
        ]);
      const prisma = {
        reportSection: { findMany: findManyLive },
        report: { findMany: findManyPublished },
        $transaction: (operation: (tx: unknown) => unknown) =>
          Promise.resolve(
            operation({
              reportSection: { findMany: findManyLive },
              report: { findMany: findManyPublished },
            }),
          ),
      } as never;

      await expect(
        queryMyHistoryPage(prisma, authorId, { limit: 20 }),
      ).rejects.toBeInstanceOf(PublishedSnapshotIntegrityError);
    },
  );
});

// Full include-shaped row: the query maps it through the report's own mapper.
function liveRow(
  id: string,
  periodStart: Date,
  createdAt: Date,
  overrides: Partial<FabricatedRow> = {},
) {
  return {
    ...baseRow({
      id,
      status: "submitted",
      submittedAt: createdAt,
      ...overrides,
    }),
    createdAt,
    updatedAt: createdAt,
    report: {
      id: "a0000000-0000-4000-8000-000000000012",
      periodStart,
      periodEnd: new Date(periodStart.getTime() + 4 * 86_400_000),
      status: "draft",
      archived: false,
      periodStatus: "open",
      publishedAt: null,
    },
  };
}

function publishedRow(id: string, periodStart: string, publishedAt: string) {
  return {
    id,
    archived: true,
    publishedSnapshot: publishedSnapshotFixture({
      reportId: id,
      periodStart: periodStart.slice(0, 10),
      periodEnd: "2026-05-08",
      publishedAt,
      sectionOwners: [
        {
          reportSectionId: id,
          authorId,
          authorName: "Test Lead",
          groupId: "a0000000-0000-4000-8000-000000000009",
          groupName: "Test Group",
        },
      ],
    }),
  };
}

function pagedPrisma(
  live: unknown[],
  published: unknown[],
  laterPublished: unknown[] = [],
) {
  let publishedCalls = 0;
  const client = {
    reportSection: {
      findMany: vi.fn((args: { where?: { OR?: unknown[] } }) => {
        const or = args.where?.OR;
        if (!or) return Promise.resolve(live);
        const last = or.at(-1);
        return Promise.resolve(
          last && typeof last === "object" && "id" in last ? [] : live,
        );
      }),
    },
    report: {
      findMany: vi.fn((args: { where?: { OR?: unknown[] } }) => {
        publishedCalls += 1;
        const or = args.where?.OR;
        if (!or) return Promise.resolve(publishedCalls === 1 ? published : []);
        const last = or.at(-1);
        return Promise.resolve(
          last && typeof last === "object" && "id" in last
            ? laterPublished
            : [],
        );
      }),
    },
  };
  return {
    ...client,
    $transaction: (operation: (tx: unknown) => unknown) =>
      Promise.resolve(operation(client)),
  } as never;
}

it.each([4, 5, 6, 7, 8])(
  "consumes UUID v%s cursors while keeping equal-coordinate live/published rows distinct",
  async (version) => {
    const instant = new Date("2026-05-04T12:00:00.000Z");
    const periodStart = new Date("2026-05-04T00:00:00.000Z");
    const id = `a0000000-0000-${version}000-8000-000000000011`;
    const prisma = pagedPrisma(
      [liveRow(id, periodStart, instant)],
      [publishedRow(id, instant.toISOString(), instant.toISOString())],
    );
    const first = await queryMyHistoryPage(prisma, authorId, { limit: 1 });
    const second = await queryMyHistoryPage(prisma, authorId, {
      limit: 1,
      cursor: first.nextCursor ?? undefined,
    });
    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);
    expect(first.items[0]?.archived).toBe(true);
    expect(second.items[0]?.archived).toBe(false);
    expect(first.items[0]?.sectionId).toBe(second.items[0]?.sectionId);
    expect(second.nextCursor).toBeNull();
  },
);

it("orders merged history by period before either source event time", async () => {
  const newerReportId = "a0000000-0000-4000-8000-000000000013";
  const prisma = pagedPrisma(
    [
      liveRow(
        sectionId,
        new Date("2026-04-27T00:00:00.000Z"),
        new Date("2026-05-20T12:00:00.000Z"),
      ),
    ],
    [
      publishedRow(
        newerReportId,
        "2026-05-04T00:00:00.000Z",
        "2026-05-10T12:00:00.000Z",
      ),
    ],
  );

  const result = await queryMyHistoryPage(prisma, authorId, { limit: 2 });

  expect(result.items.map((item) => item.reportId)).toEqual([
    newerReportId,
    "a0000000-0000-4000-8000-000000000012",
  ]);
});

it("keeps published rows sharing period and publication time distinct across pages", async () => {
  const periodStart = "2026-05-04T00:00:00.000Z";
  const publishedAt = "2026-05-10T12:00:00.000Z";
  const higherReportId = "a0000000-0000-4000-8000-000000000015";
  const lowerReportId = "a0000000-0000-4000-8000-000000000014";
  const prisma = pagedPrisma(
    [],
    [
      publishedRow(lowerReportId, periodStart, publishedAt),
      publishedRow(higherReportId, periodStart, publishedAt),
    ],
    [publishedRow(lowerReportId, periodStart, publishedAt)],
  );

  const first = await queryMyHistoryPage(prisma, authorId, { limit: 1 });
  expect(first.nextCursor).not.toBeNull();
  expect(first.items.map((item) => item.reportId)).toEqual([higherReportId]);

  const second = await queryMyHistoryPage(prisma, authorId, {
    limit: 1,
    cursor: first.nextCursor ?? undefined,
  });

  expect(second.items.map((item) => item.reportId)).toEqual([lowerReportId]);
  expect(second.nextCursor).toBeNull();
  const publishedQuery = (
    prisma as { report: { findMany: ReturnType<typeof vi.fn> } }
  ).report.findMany;
  const lastArgs = publishedQuery.mock.lastCall?.[0] as {
    where: { OR: unknown[] };
  };
  expect(lastArgs.where.OR).toContainEqual({
    periodStart: new Date(periodStart),
    publishedAt: new Date(publishedAt),
    id: { lt: higherReportId },
  });
});

it("rejects malformed opaque cursors as a typed client error", () => {
  expect(() => decodeMyHistoryCursor("not-a-cursor")).toThrow(
    ReportSectionDomainError,
  );
});

const validCursorPayload = {
  periodStart: "2026-05-04T00:00:00.000Z",
  eventAt: "2026-05-10T12:00:00.000Z",
  source: "published",
  id: reportId,
};

it.each([
  ["an empty object", {}],
  ["an unknown source", { ...validCursorPayload, source: "archived" }],
  ["a non-uuid row id", { ...validCursorPayload, id: "not-a-uuid" }],
  [
    "an unparseable periodStart",
    { ...validCursorPayload, periodStart: "not-a-date" },
  ],
])(
  "rejects a base64-json cursor with %s at the schema boundary",
  (_label, payload) => {
    const cursor = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    expect(() => decodeMyHistoryCursor(cursor)).toThrow(
      ReportSectionDomainError,
    );
  },
);
