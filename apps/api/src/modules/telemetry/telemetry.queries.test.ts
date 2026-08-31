import type { UserSession } from "@customreport/shared";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  queryActiveLeadsLastPublishedPeriod,
  querySettledPeriodSnapshots,
  settledPublicationWhere,
} from "./telemetry.queries.js";

const REPORT_A = "10000000-0000-4000-8000-000000000001";
const REPORT_B = "10000000-0000-4000-8000-000000000002";
const SECTION_A = "20000000-0000-4000-8000-000000000001";
const SECTION_B = "20000000-0000-4000-8000-000000000002";
const LEAD_A = "30000000-0000-4000-8000-000000000001";
const LEAD_B = "30000000-0000-4000-8000-000000000002";
const GROUP_A = "40000000-0000-4000-8000-000000000001";
const GROUP_B = "40000000-0000-4000-8000-000000000002";

const headA: UserSession = {
  userId: "50000000-0000-4000-8000-000000000001",
  email: "head-a@test.local",
  name: "Head A",
  role: "head",
  activeReportId: null,
  activeReportSectionId: null,
  reportingGroupId: GROUP_A,
};

function section(args: {
  reportId: string;
  sectionId: string;
  authorId: string;
  groupId: string;
  late?: boolean;
}) {
  return {
    reportSectionId: args.sectionId,
    reportId: args.reportId,
    authorId: args.authorId,
    authorName: `Lead ${args.authorId.at(-1) ?? "?"}`,
    authorRole: "lead",
    version: 1,
    status: "submitted",
    submittedAt: "2026-04-12T12:00:00.000Z",
    late: args.late ?? false,
    projects: [],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
    groupId: args.groupId,
    groupName: `Group ${args.groupId.at(-1) ?? "?"}`,
  };
}

function publishedRow(
  reportId: string,
  sections: readonly ReturnType<typeof section>[],
) {
  return {
    id: reportId,
    publishedSnapshot: {
      reportId,
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
      sections,
    },
  };
}

describe("querySettledPeriodSnapshots", () => {
  it("admits archived immutable publications as settled history", () => {
    expect(settledPublicationWhere()).toEqual({
      status: "published",
      periodStatus: "published",
      periodState: { in: ["published", "archived"] },
      publishedSnapshot: { not: Prisma.DbNull },
    });
  });

  it("returns an archived-only publication from the frozen snapshot", async () => {
    const findMany = vi.fn().mockResolvedValue([
      publishedRow(REPORT_A, [
        section({
          reportId: REPORT_A,
          sectionId: SECTION_A,
          authorId: LEAD_A,
          groupId: GROUP_A,
        }),
      ]),
    ]);
    const prisma = { report: { findMany } } as unknown as PrismaService;

    await expect(querySettledPeriodSnapshots(prisma, 1)).resolves.toHaveLength(
      1,
    );
    const call = findMany.mock.calls[0]?.[0] as {
      where: { periodState: { in: readonly string[] } };
    };
    expect(call.where.periodState).toEqual({ in: ["published", "archived"] });
  });

  it("selects only settled snapshot payloads in deterministic newest-first order", async () => {
    const row = publishedRow(REPORT_A, [
      section({
        reportId: REPORT_A,
        sectionId: SECTION_A,
        authorId: LEAD_A,
        groupId: GROUP_A,
      }),
    ]);
    const findMany = vi.fn().mockResolvedValue([row]);
    const prisma = { report: { findMany } } as unknown as PrismaService;

    const snapshots = await querySettledPeriodSnapshots(prisma, 2);

    expect(snapshots.map((snapshot) => snapshot.reportId)).toEqual([REPORT_A]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: "published",
        periodStatus: "published",
        periodState: { in: ["published", "archived"] },
        publishedSnapshot: { not: Prisma.DbNull },
      },
      orderBy: [{ periodStart: "desc" }, { id: "desc" }],
      take: 2,
      select: { id: true, publishedSnapshot: true },
    });
  });

  it("filters frozen group ownership inside an admitted snapshot", async () => {
    const findMany = vi.fn().mockResolvedValue([
      publishedRow(REPORT_A, [
        section({
          reportId: REPORT_A,
          sectionId: SECTION_A,
          authorId: LEAD_A,
          groupId: GROUP_A,
          late: true,
        }),
        section({
          reportId: REPORT_A,
          sectionId: SECTION_B,
          authorId: LEAD_B,
          groupId: GROUP_B,
        }),
      ]),
    ]);
    const prisma = { report: { findMany } } as unknown as PrismaService;

    const [snapshot] = await querySettledPeriodSnapshots(prisma, 1, headA);

    expect(snapshot?.reportId).toBe(REPORT_A);
    expect(snapshot?.sections.map((entry) => entry.authorId)).toEqual([LEAD_A]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "published",
          periodStatus: "published",
          periodState: { in: ["published", "archived"] },
          publishedSnapshot: { not: Prisma.DbNull },
          publishedSectionScopes: {
            some: { groupId: { in: [GROUP_A] } },
          },
        },
        take: 1,
      }),
    );
  });

  it("fails closed when the DB projection admits a snapshot with no matching frozen section", async () => {
    const prisma = {
      report: {
        findMany: vi.fn().mockResolvedValue([
          publishedRow(REPORT_B, [
            section({
              reportId: REPORT_B,
              sectionId: SECTION_B,
              authorId: LEAD_B,
              groupId: GROUP_B,
            }),
          ]),
        ]),
      },
    } as unknown as PrismaService;

    await expect(querySettledPeriodSnapshots(prisma, 1, headA)).rejects.toThrow(
      "Published snapshot integrity failure",
    );
  });

  it("fails closed on a malformed settled snapshot", async () => {
    const prisma = {
      report: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: REPORT_A, publishedSnapshot: {} }]),
      },
    } as unknown as PrismaService;

    await expect(querySettledPeriodSnapshots(prisma, 1, headA)).rejects.toThrow(
      "Published snapshot integrity failure",
    );
  });
});

describe("queryActiveLeadsLastPublishedPeriod", () => {
  it("counts distinct submitted authors from the scoped frozen snapshot", async () => {
    const prisma = {
      report: {
        findMany: vi.fn().mockResolvedValue([
          publishedRow(REPORT_A, [
            section({
              reportId: REPORT_A,
              sectionId: SECTION_A,
              authorId: LEAD_A,
              groupId: GROUP_A,
            }),
            section({
              reportId: REPORT_A,
              sectionId: SECTION_B,
              authorId: LEAD_B,
              groupId: GROUP_B,
            }),
          ]),
        ]),
      },
    } as unknown as PrismaService;

    await expect(
      queryActiveLeadsLastPublishedPeriod(prisma, headA),
    ).resolves.toBe(1);
  });

  it("returns zero when no settled snapshot is visible", async () => {
    const prisma = {
      report: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    await expect(
      queryActiveLeadsLastPublishedPeriod(prisma, headA),
    ).resolves.toBe(0);
  });
});
