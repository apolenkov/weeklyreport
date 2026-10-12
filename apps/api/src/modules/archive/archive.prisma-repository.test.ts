import type { Prisma } from "@prisma/client";
import {
  type PublishedReportSnapshot,
  publishedReportSnapshotSchema,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { makeReportSectionReadModel } from "../../test-utils/report-section-fixtures.js";
import { ArchivePrismaRepository } from "./archive.prisma-repository.js";
import type { ArchiveScopeSession } from "./archive.service.js";

const adminSession: ArchiveScopeSession = {
  role: "admin",
  viewerGroupAccess: [],
};

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const GROUP_A = "44444444-4444-4444-8444-444444444444";
const GROUP_B = "55555555-5555-4555-8555-555555555555";
const ITEM_ID = "66666666-6666-4666-8666-666666666666";
const ITEM_STABLE_ID = "77777777-7777-4777-8777-777777777777";
const ACTIVITY_ID = "88888888-8888-4888-8888-888888888888";

const viewerSession: ArchiveScopeSession = {
  role: "viewer",
  viewerGroupAccess: [GROUP_B],
};

function archiveRow() {
  const publishedAt = new Date("2026-08-23T18:00:00.000Z");
  return {
    id: REPORT_ID,
    publishedAt,
    publishedSnapshot: publishedReportSnapshotSchema.parse({
      reportId: REPORT_ID,
      periodStart: new Date("2026-08-17T00:00:00.000Z"),
      periodEnd: new Date("2026-08-23T23:59:59.999Z"),
      deadline: null,
      status: "published",
      publishedAt,
      publishedById: null,
      publishedByName: "system",
      portfolioOverview: {
        status: "green",
        totals: { green: 0, yellow: 0, red: 0 },
      },
      sections: [
        {
          ...makeReportSectionReadModel({
            reportSectionId: SECTION_ID,
            reportId: REPORT_ID,
            authorId: AUTHOR_ID,
            items: [
              {
                id: ITEM_ID,
                stableId: ITEM_STABLE_ID,
                projectId: null,
                activityId: ACTIVITY_ID,
                type: "current",
                text: "Archived item",
                tag: "general",
                workflowStatus: "in_progress",
                carriedOver: false,
                stageNames: [],
              },
            ],
          }),
          groupId: GROUP_A,
          groupName: "Group A",
        },
      ],
    }) as unknown as Prisma.JsonValue,
  };
}

function createRepository(options?: {
  readonly rows?: readonly unknown[];
  readonly detail?: unknown;
}) {
  const findMany = vi.fn().mockResolvedValue(options?.rows ?? []);
  const findFirst = vi.fn().mockResolvedValue(options?.detail ?? null);
  const prisma = {
    report: { findMany, findFirst },
  } as unknown as PrismaService;

  return {
    repository: new ArchivePrismaRepository(prisma),
    findMany,
    findFirst,
  };
}

describe("ArchivePrismaRepository published floor", () => {
  it("bounds the default first page and orders latest-published reports first", async () => {
    const { repository, findMany } = createRepository();

    await repository.listArchiveReports(undefined, undefined, adminSession);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          publishedAt: true,
          publishedSnapshot: true,
        },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: 21,
      }),
    );
  });

  it("keeps the published floor when a list filter requests drafts", async () => {
    const { repository, findMany } = createRepository();

    await repository.listArchiveReports(
      undefined,
      { status: "draft" },
      adminSession,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "published", archived: true },
      }),
    );
  });

  it("keeps the published floor when a detail filter requests drafts", async () => {
    const { repository, findFirst } = createRepository();
    const reportId = "6f68a008-9914-48ac-8f96-26e3ca3ab5e2";

    await repository.getArchiveReport(
      reportId,
      { status: "draft" },
      adminSession,
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          publishedAt: true,
          publishedSnapshot: true,
        },
        where: {
          id: reportId,
          status: "published",
          archived: true,
        },
      }),
    );
  });

  it("fails closed when an admitted list row has no matching snapshot sections", async () => {
    const { repository, findMany } = createRepository({ rows: [archiveRow()] });

    await expect(
      repository.listArchiveReports(undefined, undefined, viewerSession),
    ).rejects.toThrow(/Published snapshot integrity failure/);
    const query = findMany.mock.calls[0]?.[0] as
      Prisma.ReportFindManyArgs | undefined;
    expect(query?.where).toEqual({
      status: "published",
      archived: true,
      publishedSectionScopes: {
        some: { groupId: { in: [GROUP_B] } },
      },
    });
    expect(query?.take).toBe(21);
  });

  it("fails closed when an admitted detail row has no matching snapshot sections", async () => {
    const { repository, findFirst } = createRepository({
      detail: archiveRow(),
    });

    await expect(
      repository.getArchiveReport(REPORT_ID, undefined, viewerSession),
    ).rejects.toThrow(/Published snapshot integrity failure/);
    const query = findFirst.mock.calls[0]?.[0] as
      Prisma.ReportFindFirstArgs | undefined;
    expect(query?.where).toEqual({
      id: REPORT_ID,
      status: "published",
      archived: true,
      publishedSectionScopes: {
        some: { groupId: { in: [GROUP_B] } },
      },
    });
  });

  it("keeps a genuinely unauthorized detail query as no-row/null", async () => {
    const { repository } = createRepository();

    await expect(
      repository.getArchiveReport(REPORT_ID, undefined, viewerSession),
    ).resolves.toEqual({ detail: null, totalSectionCount: 0 });
  });

  it("rejects an archived snapshot record without frozen stableId", async () => {
    const row = archiveRow();
    const snapshot =
      row.publishedSnapshot as unknown as PublishedReportSnapshot;
    const malformedSnapshot = {
      ...snapshot,
      sections: snapshot.sections.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
          ...item,
          stableId: undefined,
        })),
      })),
    };
    const { repository } = createRepository({
      detail: { ...row, publishedSnapshot: malformedSnapshot },
    });

    await expect(
      repository.getArchiveReport(REPORT_ID, undefined, adminSession),
    ).rejects.toThrow(/Published snapshot integrity failure/);
  });
});
