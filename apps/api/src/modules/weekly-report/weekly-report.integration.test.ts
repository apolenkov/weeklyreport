import type { UserSession } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../lib/logger.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { AdminPrismaRepository } from "../admin/admin.prisma-repository";
import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../report-sections/index.js";
import { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository";
import { WeeklyReportService } from "./weekly-report.service";

const stageId = "a0000000-0000-4000-a000-000000000701";
const secondStageId = "a0000000-0000-4000-a000-000000000702";
const secondLeadId = "a0000000-0000-4000-a000-000000000703";
const adminSession: UserSession = {
  userId: TEST_IDS.head,
  email: "head@test.local",
  name: "Test Head",
  role: "admin",
};

describe("WeeklyReportService with Prisma (integration)", () => {
  const prisma = createTestPrisma();
  const service = new WeeklyReportService(
    new WeeklyReportPrismaRepository(prisma as unknown as PrismaService),
    createNullLogger(),
  );

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  async function seedSubmittedReport() {
    const data = await seedTestData(prisma);
    await prisma.reportSection.update({
      where: { id: data.section.id },
      data: { status: "submitted", submittedAt: new Date("2026-04-10") },
    });
    await prisma.stage.create({
      data: { id: stageId, name: "Development", sortOrder: 1 },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: data.lead.id,
        projectId: data.project.id,
        stageId,
      },
    });
    await prisma.projectStatus.create({
      data: {
        reportSectionId: data.section.id,
        projectId: data.project.id,
        status: "green",
      },
    });
    return data;
  }

  it("loads the persisted active report when reportId is omitted", async () => {
    const data = await seedSubmittedReport();

    const result = await service.getWeeklyReport(undefined, adminSession);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.reportId).toBe(data.report.id);
    expect(result.submissionCount).toBe(1);
    expect(result.totalLeads).toBe(1);
    expect(expectDefined(result.leadSections[0]).status).toBe("submitted");
  });

  it("aggregates the persisted worst product status across leads", async () => {
    const data = await seedSubmittedReport();
    await prisma.user.create({
      data: {
        id: secondLeadId,
        email: "lead2@test.local",
        name: "Test Lead 2",
        lastName: "Test",
        firstName: "Lead 2",
        role: "lead",
        samlId: "lead-test-2",
        reportingGroupId: TEST_IDS.group,
      },
    });
    const section = await prisma.reportSection.create({
      data: { reportId: data.report.id, authorId: secondLeadId },
    });
    await prisma.stage.create({
      data: { id: secondStageId, name: "QA", sortOrder: 2 },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: secondLeadId,
        projectId: data.project.id,
        stageId: secondStageId,
      },
    });
    await prisma.projectStatus.create({
      data: {
        reportSectionId: section.id,
        projectId: data.project.id,
        status: "red",
      },
    });

    const result = await service.getWeeklyReport(data.report.id, adminSession);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.portfolioOverview).toEqual([
      expect.objectContaining({
        productId: data.project.id,
        worstStatus: "red",
        stageCount: 2,
        leadNames: ["Test Lead 1", "Test Lead 2"],
        leadIds: [data.lead.id, secondLeadId].sort(),
      }),
    ]);
  });

  it("derives blocked escalations from persisted risks", async () => {
    const data = await seedSubmittedReport();
    await prisma.risk.create({
      data: {
        reportSectionId: data.section.id,
        projectId: data.project.id,
        risk: "Deployment is blocked",
        impact: "Release delay",
        mitigation: "Escalate dependency",
        severity: "blocked",
        stageNames: ["Development"],
      },
    });

    const result = await service.getWeeklyReport(data.report.id, adminSession);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.escalations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "blocked",
          description: "Deployment is blocked",
        }),
        expect.objectContaining({ type: "at_risk" }),
      ]),
    );
  });

  it("returns no lead sections or escalations while retaining portfolio membership", async () => {
    const data = await seedTestData(prisma);
    await prisma.reportSection.delete({ where: { id: data.section.id } });

    const result = await service.getWeeklyReport(data.report.id, adminSession);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.leadSections).toEqual([]);
    expect(result.portfolioOverview).toHaveLength(1);
    expect(result.escalations).toEqual([]);
    expect(result.submissionCount).toBe(0);
  });

  it("returns snapshot data for a persisted published report", async () => {
    const data = await seedSubmittedReport();
    const publishedAt = new Date("2026-04-10T00:00:00.000Z");
    await prisma.report.update({
      where: { id: data.report.id },
      data: {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt,
        publishedSnapshot: publishedSnapshotFixture({
          reportId: data.report.id,
          periodStart: data.report.periodStart,
          periodEnd: data.report.periodEnd,
          publishedAt,
        }),
      },
    });
    const publishedReport = await prisma.report.findUniqueOrThrow({
      where: { id: data.report.id },
      include: reportFullIncludeForSnapshot,
    });
    await prisma.report.update({
      where: { id: data.report.id },
      data: {
        publishedSnapshot: toPublishedSnapshotJson(
          buildAssembledReportFromPrismaRow(publishedReport),
        ),
      },
    });

    const result = await service.getWeeklyReport(data.report.id, adminSession);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(result.periodStatus).toBe("published");
    expect(result.submissionCount).toBe(1);
  });

  it("maps persisted items, risks, and decisions into lead sections", async () => {
    const data = await seedSubmittedReport();
    await Promise.all([
      prisma.item.create({
        data: {
          reportSectionId: data.section.id,
          projectId: data.project.id,
          type: "current",
          text: "Ship feature",
          tag: "feature",
          workflowStatus: "done",
          stageNames: ["Development"],
        },
      }),
      prisma.risk.create({
        data: {
          reportSectionId: data.section.id,
          projectId: data.project.id,
          risk: "Deadline slip",
          impact: "Revenue",
          mitigation: "Add capacity",
          severity: "at-risk",
          stageNames: ["Development"],
        },
      }),
      prisma.decision.create({
        data: {
          reportSectionId: data.section.id,
          productId: data.project.id,
          text: "Upgrade PostgreSQL",
          owner: "Test Lead 1",
          impact: "Performance",
          stageNames: ["Development"],
        },
      }),
    ]);

    const result = await service.getWeeklyReport(data.report.id, adminSession);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    const section = expectDefined(result.leadSections[0]);
    expect(section.items.map((item) => item.text)).toEqual(["Ship feature"]);
    expect(section.risks.map((risk) => risk.risk)).toEqual(["Deadline slip"]);
    expect(section.decisions.map((decision) => decision.text)).toEqual([
      "Upgrade PostgreSQL",
    ]);
  });

  // TASK-145.60: an admin detach leaves the staffed product without a
  // GroupProduct owner; the report must keep loading for every role.
  it("keeps loading the report after the staffed product is detached from its group", async () => {
    const data = await seedSubmittedReport();
    await new AdminPrismaRepository(prisma as never).detachProductFromGroup({
      groupId: expectDefined(data.lead.reportingGroupId),
      productId: data.project.id,
    });
    expect(
      await prisma.groupProduct.count({
        where: { productId: data.project.id },
      }),
    ).toBe(0);

    const result = await service.getWeeklyReport(data.report.id, adminSession);

    expect(result.status).toBe("active");
    if (result.status !== "active") throw new Error("expected active");
    expect(
      expectDefined(result.leadSections[0]).projects[0]?.ownerGroupId,
    ).toBeNull();

    // A scoped role reads through the group filter, not the admin bypass.
    const headResult = await service.getWeeklyReport(data.report.id, {
      ...adminSession,
      role: "head",
      reportingGroupId: TEST_IDS.group,
    });
    expect(headResult.status).toBe("active");
  });
});
