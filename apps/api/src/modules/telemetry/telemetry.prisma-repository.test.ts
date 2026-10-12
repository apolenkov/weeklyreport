import { Prisma } from "@prisma/client";
import type { UserSession } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { TelemetryPrismaRepository } from "./telemetry.prisma-repository.js";
import { TelemetryService } from "./telemetry.service.js";

const GROUP_A = "40000000-0000-4000-8000-000000000001";
const headA: UserSession = {
  userId: "50000000-0000-4000-8000-000000000001",
  email: "head-a@test.local",
  name: "Head A",
  role: "head",
  activeReportId: null,
  activeReportSectionId: null,
  reportingGroupId: GROUP_A,
};

const frozenOrLiveVisibility = {
  OR: [
    {
      status: "published",
      periodStatus: "published",
      periodState: { in: ["published", "archived"] },
      publishedSnapshot: { not: Prisma.DbNull },
      publishedSectionScopes: {
        some: { groupId: { in: [GROUP_A] } },
      },
    },
    {
      OR: [
        {
          status: "draft",
          periodStatus: "open",
          periodState: "open",
          archived: false,
        },
        {
          status: "published",
          periodStatus: "reopened",
          periodState: "open",
          archived: false,
        },
      ],
      sections: {
        some: { author: { reportingGroupId: { in: [GROUP_A] } } },
      },
    },
  ],
};

describe("TelemetryPrismaRepository bounded group queries", () => {
  function publication(
    id: string,
    status: "draft" | "submitted",
    late = false,
  ) {
    const section = (
      groupId: string,
      authorId: string,
      sectionId: string,
      sectionStatus: "draft" | "submitted",
    ) => ({
      reportSectionId: sectionId,
      reportId: id,
      authorId,
      authorName: "Lead",
      authorRole: "lead",
      version: 1,
      status: sectionStatus,
      submittedAt:
        sectionStatus === "submitted" ? "2026-04-12T12:00:00.000Z" : null,
      late,
      projects: [],
      referencedProjects: [],
      items: [],
      risks: [],
      decisions: [],
      activities: [],
      reviews: [],
      groupId,
      groupName: "Group",
    });
    return {
      id,
      publishedSnapshot: {
        reportId: id,
        periodStart: "2026-04-07T00:00:00.000Z",
        periodEnd: "2026-04-13T00:00:00.000Z",
        deadline: "2026-04-11T00:00:00.000Z",
        status: "published",
        publishedAt: "2026-04-13T12:00:00.000Z",
        publishedById: null,
        publishedByName: null,
        portfolioOverview: {
          status: "green",
          totals: { green: 0, yellow: 0, red: 0 },
        },
        sections: [
          section(
            GROUP_A,
            "30000000-0000-4000-8000-000000000001",
            "20000000-0000-4000-8000-000000000001",
            status,
          ),
          section(
            "40000000-0000-4000-8000-000000000002",
            "30000000-0000-4000-8000-000000000002",
            "20000000-0000-4000-8000-000000000002",
            "submitted",
          ),
        ],
      },
    };
  }

  it.each([
    {
      label: "latest draft",
      status: "draft" as const,
      late: false,
      headline: null,
      sparkline: [1],
    },
    {
      label: "latest late submission",
      status: "submitted" as const,
      late: true,
      headline: 0,
      sparkline: [1, 0],
    },
    {
      label: "latest on-time submission",
      status: "submitted" as const,
      late: false,
      headline: 1,
      sparkline: [1, 1],
    },
  ])(
    "composes $label from the latest scoped frozen snapshot",
    async ({ status, late, headline, sparkline }) => {
      const findMany = vi
        .fn()
        .mockResolvedValue([
          publication("10000000-0000-4000-8000-000000000001", status, late),
          publication("10000000-0000-4000-8000-000000000002", "submitted"),
        ]);
      const actualRepository = new TelemetryPrismaRepository({
        report: { findMany },
      } as unknown as PrismaService);
      const service = new TelemetryService(
        {
          onTimeRatioPerPeriod: (n, session) =>
            actualRepository.onTimeRatioPerPeriod(n, session),
          reportsThisPeriodCount: () => Promise.resolve(0),
          activeLeadsLastPublishedPeriod: () => Promise.resolve(0),
          lateSectionsLastPublishedPeriod: () => Promise.resolve(0),
          pendingReopenCount: () => Promise.resolve(0),
          pdfExportsLast7d: () => Promise.resolve(0),
        },
        { getOrCompute: (_key, fn) => fn() },
      );

      const summary = await service.getSummary(headA);
      expect(summary.onTimeRatio).toBe(headline);
      expect(summary.sparkline).toEqual(sparkline);
      expect(findMany).toHaveBeenCalledOnce();
      const query: unknown = findMany.mock.calls[0]?.[0];
      expect(query).toMatchObject({
        take: 4,
        where: {
          status: "published",
          periodStatus: "published",
          publishedSectionScopes: { some: { groupId: { in: [GROUP_A] } } },
        },
      });
    },
  );

  it("resolves one latest visible start and counts it without loading history", async () => {
    const periodStart = new Date("2026-04-07T00:00:00.000Z");
    const findFirst = vi.fn().mockResolvedValue({ periodStart });
    const count = vi.fn().mockResolvedValue(2);
    const repo = new TelemetryPrismaRepository({
      report: { findFirst, count },
    } as unknown as PrismaService);

    await expect(repo.reportsThisPeriodCount(headA)).resolves.toBe(2);
    expect(findFirst).toHaveBeenCalledOnce();
    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: frozenOrLiveVisibility,
      orderBy: { periodStart: "desc" },
      select: { periodStart: true },
    });
    const firstWhere = findFirst.mock.calls[0]?.[0] as {
      where: { OR: readonly [{}, { periodStart: { lte: Date } }] };
    };
    expect(firstWhere.where.OR[1].periodStart.lte).toBeInstanceOf(Date);
    expect(count).toHaveBeenCalledOnce();
    const countWhere = count.mock.calls[0]?.[0] as {
      where: { periodStart: Date; OR: readonly unknown[] };
    };
    expect(countWhere.where.periodStart).toBe(periodStart);
    expect(countWhere.where.OR[0]).toEqual(frozenOrLiveVisibility.OR[0]);
    expect(countWhere.where.OR[1]).toMatchObject({
      OR: frozenOrLiveVisibility.OR[1]?.OR,
    });
  });

  it("counts recent exports from immutable publication group admission", async () => {
    const count = vi.fn().mockResolvedValue(3);
    const repo = new TelemetryPrismaRepository({
      pdfExportJob: { count },
    } as unknown as PrismaService);

    await expect(repo.pdfExportsLast7d(headA)).resolves.toBe(3);
    const query = count.mock.calls[0]?.[0] as {
      readonly where: {
        readonly createdAt: { readonly gte: Date };
        readonly publicationGroupIds: { readonly hasSome: readonly string[] };
      };
    };
    expect(query.where.createdAt.gte).toBeInstanceOf(Date);
    expect(query.where.publicationGroupIds).toEqual({ hasSome: [GROUP_A] });
  });

  it("keeps admin report admission unscoped while retaining bounded queries", async () => {
    const periodStart = new Date("2026-04-07T00:00:00.000Z");
    const findFirst = vi.fn().mockResolvedValue({ periodStart });
    const count = vi.fn().mockResolvedValue(1);
    const repo = new TelemetryPrismaRepository({
      report: { findFirst, count },
    } as unknown as PrismaService);

    await expect(
      repo.reportsThisPeriodCount({ ...headA, role: "admin" }),
    ).resolves.toBe(1);
    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: {
        OR: [
          {
            status: "published",
            periodStatus: "published",
            periodState: { in: ["published", "archived"] },
            publishedSnapshot: { not: Prisma.DbNull },
          },
          { OR: frozenOrLiveVisibility.OR[1]?.OR },
        ],
      },
      orderBy: { periodStart: "desc" },
      select: { periodStart: true },
    });
    expect(count.mock.calls[0]?.[0]).toMatchObject({
      where: { periodStart },
    });
    const adminCountWhere = count.mock.calls[0]?.[0] as {
      where: { OR: readonly unknown[] };
    };
    expect(adminCountWhere.where.OR).toHaveLength(2);
  });
});
