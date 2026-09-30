import type { UserSession } from "@customreport/shared";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper.js";
import { TelemetryPrismaRepository } from "./telemetry.prisma-repository.js";
import { TelemetryService } from "./telemetry.service.js";

const GROUP_B = "b0000000-0000-4000-8000-00000000000b";
const LEAD_B = "b0000000-0000-4000-8000-0000000000b1";
const SECTION_B = "b0000000-0000-4000-8000-0000000000b2";
const REPORT_B = "b0000000-0000-4000-8000-0000000000b3";
const REPORT_B_SECTION = "b0000000-0000-4000-8000-0000000000b4";
const REOPENED_REPORT = "a0000000-0000-4000-8000-0000000000a3";
const REOPENED_SECTION = "a0000000-0000-4000-8000-0000000000a4";
const SECOND_LEAD = "a0000000-0000-4000-8000-0000000000a5";
const REOPENED_PUBLISHED_AT = new Date("2026-04-20T12:00:00.000Z");
const SCHEDULED_REPORT = "a0000000-0000-4000-8000-0000000000b1";
const SCHEDULED_SECTION = "a0000000-0000-4000-8000-0000000000b2";
const ARCHIVED_DRAFT_REPORT = "a0000000-0000-4000-8000-0000000000b3";
const ARCHIVED_DRAFT_SECTION = "a0000000-0000-4000-8000-0000000000b4";
type TestData = Awaited<ReturnType<typeof seedTestData>>;

function telemetrySnapshot(args: {
  readonly reportId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly deadline: Date;
  readonly publishedAt: Date;
  readonly sections: readonly {
    readonly sectionId: string;
    readonly authorId: string;
    readonly authorName: string;
    readonly groupId: string;
    readonly groupName: string;
    readonly late: boolean;
  }[];
}): Prisma.InputJsonValue {
  return {
    reportId: args.reportId,
    periodStart: args.periodStart.toISOString(),
    periodEnd: args.periodEnd.toISOString(),
    deadline: args.deadline.toISOString(),
    status: "published",
    publishedAt: args.publishedAt.toISOString(),
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green",
      totals: { green: 0, yellow: 0, red: 0 },
    },
    sections: args.sections.map((section) => ({
      reportSectionId: section.sectionId,
      reportId: args.reportId,
      authorId: section.authorId,
      authorName: section.authorName,
      authorRole: "lead",
      version: 1,
      status: "submitted",
      submittedAt: args.publishedAt.toISOString(),
      late: section.late,
      projects: [],
      referencedProjects: [],
      items: [],
      risks: [],
      decisions: [],
      activities: [],
      reviews: [],
      groupId: section.groupId,
      groupName: section.groupName,
    })),
  };
}

const headA: UserSession = {
  userId: TEST_IDS.head,
  email: "head-a@test.local",
  name: "Head A",
  role: "head",
  activeReportId: null,
  activeReportSectionId: null,
  reportingGroupId: TEST_IDS.group,
};

describe("Telemetry group scoping (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new TelemetryPrismaRepository(
    prisma as unknown as PrismaService,
  );
  const service = new TelemetryService(repository, {
    getOrCompute: (_key, compute) => compute(),
  });

  async function seedGroupB(): Promise<void> {
    await prisma.reportingGroup.create({
      data: { id: GROUP_B, name: "Group B", description: "Other group" },
    });
    await prisma.user.create({
      data: {
        id: LEAD_B,
        email: "lead-b@test.local",
        name: "Lead B",
        lastName: "B",
        firstName: "Lead",
        role: "lead",
        samlId: "lead-b",
        reportingGroupId: GROUP_B,
      },
    });
  }

  async function seedGroupA(): Promise<TestData> {
    const testData = await seedTestData(prisma);
    if (!testData.report.deadline) {
      throw new Error("seeded report requires a deadline");
    }
    const publishedAt = new Date("2026-04-13T12:00:00.000Z");
    await Promise.all([
      prisma.report.update({
        where: { id: testData.report.id },
        data: {
          status: "published",
          periodStatus: "published",
          periodState: "published",
          publishedAt,
          publishedSnapshot: telemetrySnapshot({
            reportId: testData.report.id,
            periodStart: testData.report.periodStart,
            periodEnd: testData.report.periodEnd,
            deadline: testData.report.deadline,
            publishedAt,
            sections: [
              {
                sectionId: testData.section.id,
                authorId: testData.lead.id,
                authorName: testData.lead.name,
                groupId: TEST_IDS.group,
                groupName: "Test Group",
                late: true,
              },
            ],
          }),
        },
      }),
      prisma.reportSection.update({
        where: { id: testData.section.id },
        data: { status: "submitted", late: true },
      }),
    ]);
    return testData;
  }

  async function seedGroupBReports(testData: TestData): Promise<void> {
    if (!testData.report.deadline) {
      throw new Error("seeded report requires a deadline");
    }
    await seedGroupB();
    await prisma.reportSection.create({
      data: {
        id: SECTION_B,
        reportId: testData.report.id,
        authorId: LEAD_B,
        status: "submitted",
        late: true,
      },
    });
    await prisma.report.create({
      data: {
        id: REPORT_B,
        periodStart: testData.report.periodStart,
        periodEnd: testData.report.periodEnd,
        deadline: testData.report.deadline,
        status: "draft",
        periodStatus: "open",
        periodState: "open",
      },
    });
    await prisma.reportSection.create({
      data: {
        id: REPORT_B_SECTION,
        reportId: REPORT_B,
        authorId: LEAD_B,
        status: "submitted",
      },
    });
    const publishedAt = new Date("2026-04-13T12:00:00.000Z");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        publishedSnapshot: telemetrySnapshot({
          reportId: testData.report.id,
          periodStart: testData.report.periodStart,
          periodEnd: testData.report.periodEnd,
          deadline: testData.report.deadline,
          publishedAt,
          sections: [
            {
              sectionId: testData.section.id,
              authorId: testData.lead.id,
              authorName: testData.lead.name,
              groupId: TEST_IDS.group,
              groupName: "Test Group",
              late: true,
            },
            {
              sectionId: SECTION_B,
              authorId: LEAD_B,
              authorName: "Lead B",
              groupId: GROUP_B,
              groupName: "Group B",
              late: true,
            },
          ],
        }),
      },
    });
    await prisma.publishedSectionScope.createMany({
      data: [
        {
          reportId: testData.report.id,
          reportSectionId: testData.section.id,
          authorId: testData.lead.id,
          groupId: TEST_IDS.group,
        },
        {
          reportId: testData.report.id,
          reportSectionId: SECTION_B,
          authorId: LEAD_B,
          groupId: GROUP_B,
        },
      ],
    });
  }

  async function seedScopedRows(
    sectionAId: string,
    publicationSnapshot: Prisma.InputJsonValue,
  ): Promise<void> {
    await Promise.all([
      prisma.reopenRequest.create({
        data: {
          reportSectionId: sectionAId,
          requestedById: TEST_IDS.lead,
          status: "pending",
        },
      }),
      prisma.reopenRequest.create({
        data: {
          reportSectionId: SECTION_B,
          requestedById: LEAD_B,
          status: "pending",
        },
      }),
      prisma.pdfExportJob.create({
        data: {
          reportId: TEST_IDS.report,
          requestedBy: TEST_IDS.head,
          templateVersion: "phase-2-pdf-v1",
          publicationAt: new Date("2026-04-13T12:00:00.000Z"),
          publicationSnapshot,
          publicationGroupIds: [TEST_IDS.group],
        },
      }),
      prisma.pdfExportJob.create({
        data: {
          reportId: REPORT_B,
          requestedBy: LEAD_B,
          templateVersion: "phase-2-pdf-v1",
          publicationAt: new Date("2026-04-13T12:00:00.000Z"),
          publicationSnapshot: telemetrySnapshot({
            reportId: REPORT_B,
            periodStart: new Date("2026-04-13T00:00:00.000Z"),
            periodEnd: new Date("2026-04-19T23:59:59.999Z"),
            deadline: new Date("2026-04-20T15:00:00.000Z"),
            publishedAt: new Date("2026-04-13T12:00:00.000Z"),
            sections: [],
          }),
          publicationGroupIds: [GROUP_B],
        },
      }),
    ]);
  }

  beforeEach(async () => {
    await cleanDatabase();
    const testData = await seedGroupA();
    await seedGroupBReports(testData);
    await seedScopedRows(
      testData.section.id,
      telemetrySnapshot({
        reportId: TEST_IDS.report,
        periodStart: testData.report.periodStart,
        periodEnd: testData.report.periodEnd,
        deadline: testData.report.deadline ?? testData.report.periodEnd,
        publishedAt: new Date("2026-04-13T12:00:00.000Z"),
        sections: [
          {
            sectionId: testData.section.id,
            authorId: TEST_IDS.lead,
            authorName: "Lead A",
            groupId: TEST_IDS.group,
            groupName: "Group A",
            late: true,
          },
        ],
      }),
    );
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("excludes group-B reports, sections, reopens, and exports", async () => {
    await expect(prisma.report.count()).resolves.toBe(2);
    await expect(prisma.reopenRequest.count()).resolves.toBe(2);
    await expect(prisma.pdfExportJob.count()).resolves.toBe(2);

    await expect(service.getSummary(headA)).resolves.toMatchObject({
      reportsThisPeriod: 1,
      activeLeads: 1,
      lateSections: 1,
      pendingReopens: 1,
      pdfExportsLast7d: 1,
      onTimeRatio: 0,
      sparkline: [0],
    });
  });

  it("does not let scheduled or archived drafts replace the current telemetry period", async () => {
    const current = await prisma.report.findUniqueOrThrow({
      where: { id: TEST_IDS.report },
    });
    const futureStart = new Date("2099-01-01T00:00:00.000Z");
    const archivedStart = new Date(current.periodStart.getTime() + 86_400_000);
    await prisma.report.createMany({
      data: [
        {
          id: SCHEDULED_REPORT,
          periodStart: futureStart,
          periodEnd: futureStart,
          deadline: futureStart,
          status: "draft",
          periodStatus: "open",
          periodState: "scheduled",
        },
        {
          id: ARCHIVED_DRAFT_REPORT,
          periodStart: archivedStart,
          periodEnd: archivedStart,
          deadline: archivedStart,
          status: "draft",
          periodStatus: "open",
          periodState: "archived",
          archived: true,
        },
      ],
    });
    await prisma.reportSection.createMany({
      data: [
        {
          id: SCHEDULED_SECTION,
          reportId: SCHEDULED_REPORT,
          authorId: TEST_IDS.lead,
          status: "submitted",
        },
        {
          id: ARCHIVED_DRAFT_SECTION,
          reportId: ARCHIVED_DRAFT_REPORT,
          authorId: TEST_IDS.lead,
          status: "submitted",
        },
      ],
    });
    await prisma.pdfExportJob.createMany({
      data: [
        {
          reportId: SCHEDULED_REPORT,
          requestedBy: TEST_IDS.head,
          templateVersion: "phase-2-pdf-v1",
          publicationAt: futureStart,
          publicationSnapshot: telemetrySnapshot({
            reportId: SCHEDULED_REPORT,
            periodStart: futureStart,
            periodEnd: futureStart,
            deadline: futureStart,
            publishedAt: futureStart,
            sections: [],
          }),
          publicationGroupIds: [],
        },
        {
          reportId: ARCHIVED_DRAFT_REPORT,
          requestedBy: TEST_IDS.head,
          templateVersion: "phase-2-pdf-v1",
          publicationAt: archivedStart,
          publicationSnapshot: telemetrySnapshot({
            reportId: ARCHIVED_DRAFT_REPORT,
            periodStart: archivedStart,
            periodEnd: archivedStart,
            deadline: archivedStart,
            publishedAt: archivedStart,
            sections: [],
          }),
          publicationGroupIds: [],
        },
      ],
    });

    await expect(repository.reportsThisPeriodCount(headA)).resolves.toBe(1);
    await expect(repository.pdfExportsLast7d(headA)).resolves.toBe(1);
  });

  it("excludes a reopened period until it is republished", async () => {
    const settled = await prisma.report.findUniqueOrThrow({
      where: { id: TEST_IDS.report },
    });
    if (!settled.deadline) {
      throw new Error("seeded settled period must carry a deadline");
    }
    await prisma.user.create({
      data: {
        id: SECOND_LEAD,
        email: "lead-a2@test.local",
        name: "Lead A2",
        lastName: "A2",
        firstName: "Lead",
        role: "lead",
        samlId: "lead-a2",
        reportingGroupId: TEST_IDS.group,
      },
    });
    const reopenedPeriodStart = new Date(
      settled.periodStart.getTime() + 7 * 86_400_000,
    );
    const reopenedPeriodEnd = new Date(
      settled.periodEnd.getTime() + 7 * 86_400_000,
    );
    const reopenedDeadline = new Date(
      settled.deadline.getTime() + 7 * 86_400_000,
    );
    await prisma.report.create({
      data: {
        id: REOPENED_REPORT,
        periodStart: reopenedPeriodStart,
        periodEnd: reopenedPeriodEnd,
        deadline: reopenedDeadline,
        status: "published",
        periodStatus: "reopened",
        periodState: "open",
        publishedAt: REOPENED_PUBLISHED_AT,
        reopenedAt: REOPENED_PUBLISHED_AT,
        publishedSnapshot: telemetrySnapshot({
          reportId: REOPENED_REPORT,
          periodStart: reopenedPeriodStart,
          periodEnd: reopenedPeriodEnd,
          deadline: reopenedDeadline,
          publishedAt: REOPENED_PUBLISHED_AT,
          sections: [
            {
              sectionId: REOPENED_SECTION,
              authorId: SECOND_LEAD,
              authorName: "Lead A2",
              groupId: TEST_IDS.group,
              groupName: "Test Group",
              late: false,
            },
          ],
        }),
      },
    });
    await prisma.reportSection.create({
      data: {
        id: REOPENED_SECTION,
        reportId: REOPENED_REPORT,
        authorId: SECOND_LEAD,
        status: "submitted",
        late: false,
      },
    });
    await prisma.publishedSectionScope.create({
      data: {
        reportId: REOPENED_REPORT,
        reportSectionId: REOPENED_SECTION,
        authorId: SECOND_LEAD,
        groupId: TEST_IDS.group,
      },
    });

    await expect(
      repository.activeLeadsLastPublishedPeriod(headA),
    ).resolves.toBe(1);
    await expect(
      repository.lateSectionsLastPublishedPeriod(headA),
    ).resolves.toBe(1);
    await expect(repository.onTimeRatioPerPeriod(1, headA)).resolves.toEqual([
      0,
    ]);

    await prisma.report.update({
      where: { id: REOPENED_REPORT },
      data: { periodStatus: "published", periodState: "published" },
    });

    await expect(
      repository.activeLeadsLastPublishedPeriod(headA),
    ).resolves.toBe(1);
    await expect(
      repository.lateSectionsLastPublishedPeriod(headA),
    ).resolves.toBe(0);
    await expect(repository.onTimeRatioPerPeriod(1, headA)).resolves.toEqual([
      1,
    ]);
  });

  it("keeps settled telemetry stable after live section deletion and user-group drift", async () => {
    const before = await Promise.all([
      repository.reportsThisPeriodCount(headA),
      repository.activeLeadsLastPublishedPeriod(headA),
      repository.lateSectionsLastPublishedPeriod(headA),
      repository.pdfExportsLast7d(headA),
      repository.onTimeRatioPerPeriod(4, headA),
    ]);

    await prisma.reportSection.deleteMany({
      where: { reportId: TEST_IDS.report },
    });
    await prisma.user.update({
      where: { id: TEST_IDS.lead },
      data: { reportingGroupId: GROUP_B },
    });

    const after = await Promise.all([
      repository.reportsThisPeriodCount(headA),
      repository.activeLeadsLastPublishedPeriod(headA),
      repository.lateSectionsLastPublishedPeriod(headA),
      repository.pdfExportsLast7d(headA),
      repository.onTimeRatioPerPeriod(4, headA),
    ]);

    expect(after).toEqual(before);
  });
});
