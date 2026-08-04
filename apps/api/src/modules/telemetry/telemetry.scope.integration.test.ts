import type { UserSession } from "@customreport/shared";
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
type TestData = Awaited<ReturnType<typeof seedTestData>>;

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
  const service = new TelemetryService(repository);

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
    await Promise.all([
      prisma.report.update({
        where: { id: testData.report.id },
        data: {
          status: "published",
          periodStatus: "published",
          periodState: "published",
          publishedAt: new Date("2026-04-13T12:00:00.000Z"),
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
  }

  async function seedScopedRows(sectionAId: string): Promise<void> {
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
        },
      }),
      prisma.pdfExportJob.create({
        data: {
          reportId: REPORT_B,
          requestedBy: LEAD_B,
          templateVersion: "phase-2-pdf-v1",
        },
      }),
    ]);
  }

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const testData = await seedGroupA();
    await seedGroupBReports(testData);
    await seedScopedRows(testData.section.id);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
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
    await prisma.report.create({
      data: {
        id: REOPENED_REPORT,
        periodStart: new Date(settled.periodStart.getTime() + 7 * 86_400_000),
        periodEnd: new Date(settled.periodEnd.getTime() + 7 * 86_400_000),
        deadline: new Date(settled.deadline.getTime() + 7 * 86_400_000),
        status: "published",
        periodStatus: "reopened",
        periodState: "open",
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
});
