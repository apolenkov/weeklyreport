import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import type { SelectableReportSource } from "../domain/period-source-selection.js";
import { ReportSearchPrismaRepository } from "./report-search.prisma-repository.js";

const REPORT_ID = "659b2767-0f86-41e2-b025-49730ca010e4";
const SECTION_ID = "2a223d8b-c4b2-473c-8a7b-15ecc52195c7";
const AUTHOR_ID = "6f99661a-cac6-4d06-bf08-2a14cced554d";
const ACTOR_ID = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";
const SHARED_PRODUCT_ID = "eeb16c80-2f85-48a0-b838-d8096981ddba";
const REOPENED_REPORT_ID = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";
const ARCHIVED_PUBLISHED_REPORT_ID = "11111111-1111-4111-8111-111111111111";
const MISSING_SNAPSHOT_REPORT_ID = "22222222-2222-4222-8222-222222222222";

function createRepository() {
  const findMany = vi.fn();
  const findUnique = vi.fn();
  const findSection = vi.fn();
  const findAssignments = vi.fn();
  const prisma = {
    report: { findMany, findUnique },
    reportSection: { findUnique: findSection },
    stageAssignment: { findMany: findAssignments },
  } as unknown as PrismaService;
  return {
    repository: new ReportSearchPrismaRepository(prisma),
    findMany,
    findUnique,
    findSection,
    findAssignments,
  };
}

function snapshotSection() {
  return {
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Alice Lead",
    authorRole: "lead",
    version: 1,
    status: "submitted" as const,
    submittedAt: null,
    late: false,
    groupId: "11111111-1111-4111-8111-111111111111",
    groupName: "Group 1",
    projects: [],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
  };
}

function snapshot() {
  return {
    reportId: REPORT_ID,
    periodStart: "2026-08-01",
    periodEnd: "2026-08-07",
    deadline: "2026-08-07",
    status: "published" as const,
    publishedAt: "2026-08-07T12:00:00.000Z",
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green" as const,
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: [snapshotSection()],
  };
}

const source = (overrides: Partial<SelectableReportSource> = {}) => ({
  reportId: REPORT_ID,
  periodId: REPORT_ID,
  periodLabel: "W32",
  periodStart: new Date("2026-08-01T00:00:00.000Z"),
  periodStatus: "published" as const,
  source: "snapshot" as const,
  ...overrides,
});

describe("ReportSearchPrismaRepository", () => {
  it("lists only editable live reports and published reports with snapshots", async () => {
    const { repository, findMany } = createRepository();
    findMany
      .mockResolvedValueOnce([
        {
          id: REPORT_ID,
          periodStart: new Date("2026-08-01"),
          status: "draft",
          periodStatus: "open",
          periodState: "open",
          weekLabel: "W32",
          archived: false,
          publishedSnapshot: null,
        },
        {
          id: "eeb16c80-2f85-48a0-b838-d8096981ddba",
          periodStart: new Date("2026-07-11"),
          status: "published",
          periodStatus: "reopened",
          periodState: "open",
          weekLabel: "W29",
          archived: false,
          publishedSnapshot: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "2a223d8b-c4b2-473c-8a7b-15ecc52195c7",
          periodStart: new Date("2026-07-25"),
          status: "published",
          periodStatus: "published",
          periodState: "archived",
          weekLabel: null,
          archived: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "2a223d8b-c4b2-473c-8a7b-15ecc52195c7",
          publishedSnapshot: snapshot(),
        },
      ]);

    await expect(repository.listSources()).resolves.toEqual([
      expect.objectContaining({ reportId: REPORT_ID, source: "live" }),
      expect.objectContaining({
        reportId: "eeb16c80-2f85-48a0-b838-d8096981ddba",
        source: "live",
      }),
      expect.objectContaining({
        reportId: "2a223d8b-c4b2-473c-8a7b-15ecc52195c7",
        source: "snapshot",
        periodLabel: "2026-07-25",
      }),
    ]);
  });

  it("fails closed for scheduled and contradictory lifecycle tuples", async () => {
    const { repository, findMany } = createRepository();
    findMany
      .mockResolvedValueOnce([
        {
          id: "scheduled",
          periodStart: new Date("2026-08-01"),
          status: "draft",
          periodStatus: "open",
          periodState: "scheduled",
          weekLabel: "Scheduled",
          archived: false,
        },
        {
          id: "reopened-with-draft-status",
          periodStart: new Date("2026-07-31"),
          status: "draft",
          periodStatus: "reopened",
          periodState: "open",
          weekLabel: "Invalid reopened",
          archived: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "published-with-draft-status",
          periodStart: new Date("2026-07-30"),
          status: "draft",
          periodStatus: "published",
          periodState: "published",
          weekLabel: "Invalid published",
          archived: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "published-with-draft-status",
          publishedSnapshot: snapshot(),
        },
      ]);

    await expect(
      repository.listSources({ publishedMode: "all" }),
    ).resolves.toEqual([]);
  });

  it("matches named periods case-insensitively and falls back to ISO labels", async () => {
    const { repository, findMany } = createRepository();
    findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "named-label",
          periodStart: new Date("2026-07-25"),
          status: "published",
          periodStatus: "published",
          periodState: "published",
          weekLabel: "WEEK 30",
          archived: false,
        },
        {
          id: "iso-fallback",
          periodStart: new Date("2026-07-18"),
          status: "published",
          periodStatus: "published",
          periodState: "published",
          weekLabel: null,
          archived: false,
        },
      ])
      .mockResolvedValueOnce([
        { id: "named-label", publishedSnapshot: snapshot() },
        { id: "iso-fallback", publishedSnapshot: snapshot() },
      ]);

    await expect(
      repository.listSources({
        publishedMode: "named",
        publishedLabels: ["week 30", "2026-07-18"],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        reportId: "named-label",
        periodLabel: "WEEK 30",
      }),
      expect.objectContaining({
        reportId: "iso-fallback",
        periodLabel: "2026-07-18",
      }),
    ]);
  });

  it("loads live sections with the canonical report-section include", async () => {
    const { repository, findUnique } = createRepository();
    findUnique.mockResolvedValue({ sections: [] });
    const live = source({
      source: "live",
      periodStatus: "open",
    });

    await expect(repository.loadOccurrences([live])).resolves.toEqual([
      {
        reportId: live.reportId,
        periodId: live.periodId,
        periodLabel: live.periodLabel,
        periodStart: live.periodStart,
        source: "live",
        sections: [],
      },
    ]);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: REPORT_ID,
          periodStatus: "open",
          OR: [
            { status: "draft", periodStatus: "open" },
            { status: "published", periodStatus: "reopened" },
          ],
          periodState: "open",
          archived: false,
        },
      }),
    );
  });

  it("parses the immutable snapshot and never reads its live sections", async () => {
    const { repository, findUnique } = createRepository();
    findUnique.mockResolvedValue({
      id: REPORT_ID,
      publishedSnapshot: snapshot(),
    });

    await expect(repository.loadOccurrences([source()])).resolves.toEqual([
      expect.objectContaining({
        reportId: REPORT_ID,
        source: "snapshot",
        sections: [expect.objectContaining({ reportSectionId: SECTION_ID })],
      }),
    ]);
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: REPORT_ID,
        status: "published",
        periodStatus: "published",
        OR: [
          { archived: false, periodState: "published" },
          { archived: true, periodState: "archived" },
        ],
      },
      select: { publishedSnapshot: true },
    });
  });

  it("reads own access and shared products in one repeatable-read transaction", async () => {
    const transaction = vi.fn((callback: (tx: unknown) => unknown) =>
      callback({
        reportSection: {
          findMany: vi.fn().mockResolvedValue([{ reportId: REPORT_ID }]),
        },
        stageAssignment: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { userId: AUTHOR_ID, projectId: SHARED_PRODUCT_ID },
            ]),
        },
      }),
    );
    const { repository } = createRepository();
    Object.assign(repository, {});
    const repositoryWithTransaction = new ReportSearchPrismaRepository({
      $transaction: transaction,
    } as unknown as PrismaService);
    await expect(
      repositoryWithTransaction.getAuthorizationSnapshot(
        ACTOR_ID,
        [REPORT_ID],
        [AUTHOR_ID],
      ),
    ).resolves.toEqual({
      ownSectionReportIds: [REPORT_ID],
      sharedProductIdsByAuthor: new Map([[AUTHOR_ID, [SHARED_PRODUCT_ID]]]),
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: expect.anything() as unknown,
    });
  });

  it("rejects an unbounded published history with a typed result-set error", async () => {
    const { repository, findMany } = createRepository();
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce(
      Array.from({ length: 53 }, (_, index) => ({
        id: `659b2767-0f86-41e2-b025-49730ca0${String(index).padStart(4, "0")}`,
        periodStart: new Date(
          `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
        ),
        status: "published",
        periodStatus: "published",
        periodState: "published",
        weekLabel: `W${index}`,
        archived: false,
      })),
    );

    await expect(
      repository.listSources({ publishedMode: "all" }),
    ).rejects.toMatchObject({ code: "result_set_too_large" });
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      name: "none",
      options: { publishedMode: "none" as const },
      expectedPublished: [],
      expectedCalls: 1,
    },
    {
      name: "latest with zero count",
      options: { publishedMode: "latest" as const, publishedCount: 0 },
      expectedPublished: [],
      expectedCalls: 2,
    },
    {
      name: "latest with one item",
      options: { publishedMode: "latest" as const, publishedCount: 1 },
      expectedPublished: [ARCHIVED_PUBLISHED_REPORT_ID],
      expectedCalls: 3,
    },
    {
      name: "named labels",
      options: {
        publishedMode: "named" as const,
        publishedLabels: ["W1"],
      },
      expectedPublished: [ARCHIVED_PUBLISHED_REPORT_ID],
      expectedCalls: 3,
    },
    {
      name: "all",
      options: { publishedMode: "all" as const },
      expectedPublished: [ARCHIVED_PUBLISHED_REPORT_ID],
      expectedCalls: 3,
    },
  ])(
    "honours published mode and count contract: $name",
    async ({ options, expectedPublished, expectedCalls }) => {
      const { repository, findMany } = createRepository();
      const currentRows = [
        {
          id: REPORT_ID,
          periodStart: new Date("2026-08-01"),
          status: "draft",
          periodStatus: "open",
          periodState: "open",
          weekLabel: "Current",
          archived: false,
        },
        {
          id: REOPENED_REPORT_ID,
          periodStart: new Date("2026-07-31"),
          status: "published",
          periodStatus: "reopened",
          periodState: "open",
          weekLabel: "Reopened",
          archived: false,
        },
      ];
      const publishedRows = [
        {
          id: ARCHIVED_PUBLISHED_REPORT_ID,
          periodStart: new Date("2026-07-25"),
          status: "published",
          periodStatus: "published",
          periodState: "archived",
          weekLabel: "W1",
          archived: true,
        },
        {
          id: MISSING_SNAPSHOT_REPORT_ID,
          periodStart: new Date("2026-07-18"),
          status: "published",
          periodStatus: "published",
          periodState: "published",
          weekLabel: "W2",
          archived: false,
        },
      ];
      const selectedPublishedRows =
        options.publishedMode === "none"
          ? []
          : options.publishedMode === "named"
            ? publishedRows.filter((row) =>
                options.publishedLabels.includes(row.weekLabel),
              )
            : options.publishedMode === "latest"
              ? publishedRows.slice(0, options.publishedCount)
              : publishedRows;
      findMany
        .mockResolvedValueOnce(currentRows)
        .mockResolvedValueOnce(selectedPublishedRows)
        .mockResolvedValueOnce([
          { id: ARCHIVED_PUBLISHED_REPORT_ID, publishedSnapshot: snapshot() },
          { id: MISSING_SNAPSHOT_REPORT_ID, publishedSnapshot: null },
        ]);

      const sources = await repository.listSources(options);

      expect(sources.map((entry) => entry.reportId)).toEqual([
        REPORT_ID,
        REOPENED_REPORT_ID,
        ...expectedPublished,
      ]);
      expect(
        sources
          .filter((entry) => entry.source === "live")
          .map((entry) => [entry.reportId, entry.periodStatus]),
      ).toEqual([
        [REPORT_ID, "open"],
        [REOPENED_REPORT_ID, "reopened"],
      ]);
      expect(findMany).toHaveBeenCalledTimes(expectedCalls);
    },
  );

  it.each([{ publishedCount: -1 }, { publishedCount: 53 }])(
    "rejects published count $publishedCount before querying",
    async ({ publishedCount }) => {
      const { repository, findMany } = createRepository();

      await expect(
        repository.listSources({ publishedMode: "latest", publishedCount }),
      ).rejects.toMatchObject({ code: "result_set_too_large" });
      expect(findMany).not.toHaveBeenCalled();
    },
  );
});
