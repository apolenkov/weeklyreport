import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { PeriodPrismaRepository } from "../period/period.prisma-repository.js";
import { ArchivePrismaRepository } from "./archive.prisma-repository";

describe("ArchivePrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: ArchivePrismaRepository;
  let periodRepo: PeriodPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new ArchivePrismaRepository(prisma as never);
    periodRepo = new PeriodPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("listArchiveReports returns only published reports", async () => {
    // The seeded report is draft, so archive should be empty
    const emptyList = await repo.listArchiveReports();
    expect(emptyList).toHaveLength(0);

    // Publish the report AND set archived=true (A22: both flags required)
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        publishedAt: new Date("2026-04-12T10:00:00.000Z"),
        publishedById: testData.head.id,
        archived: true,
      },
    });

    // Add a project status to the section so portfolio overview works
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });

    const list = await repo.listArchiveReports();
    expect(list).toHaveLength(1);
    expect(expectDefined(list[0]).reportId).toBe(testData.report.id);
    expect(expectDefined(list[0]).publishedByName).toBe("Test Head");
    expect(expectDefined(list[0]).portfolioStatus).toBe("green");
  });

  it("A22: published-but-NOT-archived reports do NOT appear in archive list", async () => {
    // Publish the report WITHOUT setting archived=true
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        publishedAt: new Date("2026-04-12T10:00:00.000Z"),
        publishedById: testData.head.id,
        // archived remains false (default)
      },
    });

    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });

    // A22: archive must be empty — published but not explicitly archived
    const list = await repo.listArchiveReports();
    expect(list).toHaveLength(0);
  });

  it("A22: published-AND-archived reports DO appear in archive list", async () => {
    // Publish and explicitly archive the report
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        publishedAt: new Date("2026-04-12T10:00:00.000Z"),
        publishedById: testData.head.id,
        archived: true,
      },
    });

    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "yellow",
      },
    });

    const list = await repo.listArchiveReports();
    expect(list).toHaveLength(1);
    expect(expectDefined(list[0]).reportId).toBe(testData.report.id);
  });

  it("getArchiveReport returns full detail for published report", async () => {
    // Publish the report with some data AND set archived=true (A22: required)
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        publishedAt: new Date("2026-04-12T10:00:00.000Z"),
        publishedById: testData.head.id,
        archived: true,
      },
    });

    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "yellow",
      },
    });

    await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "Archive item",
        tag: "feature",
        workflowStatus: "done",
        carriedOver: false,
      },
    });

    const detail = await repo.getArchiveReport(testData.report.id);

    expect(detail).not.toBeNull();
    expect(expectDefined(detail).summary.reportId).toBe(testData.report.id);
    expect(expectDefined(detail).summary.portfolioStatus).toBe("yellow");
    expect(expectDefined(detail).report.sections).toHaveLength(1);
    expect(
      expectDefined(expectDefined(detail).report.sections[0]).items,
    ).toHaveLength(1);
    expect(
      expectDefined(
        expectDefined(expectDefined(detail).report.sections[0]).items[0],
      ).text,
    ).toBe("Archive item");
  });

  it("D-6: archive detail reads the publish-time snapshot after draft edits", async () => {
    const stage = await prisma.stage.create({
      data: {
        id: "a0000000-0000-4000-a000-000000000aa3",
        name: "Development",
        sortOrder: 3,
      },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        projectId: testData.project.id,
        stageId: stage.id,
      },
    });
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "yellow",
      },
    });
    const item = await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "Published snapshot item",
        tag: "feature",
        workflowStatus: "done",
        carriedOver: false,
      },
    });

    await periodRepo.publishPeriod(testData.report.id, testData.head.id);
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { archived: true, periodState: "archived" },
    });
    await prisma.item.update({
      where: { id: item.id },
      data: { text: "Draft edit after publish" },
    });

    const detail = await repo.getArchiveReport(testData.report.id);

    expect(detail).not.toBeNull();
    expect(expectDefined(detail).summary.portfolioStatus).toBe("yellow");
    expect(
      expectDefined(
        expectDefined(expectDefined(detail).report.sections[0]).items[0],
      ).text,
    ).toBe("Published snapshot item");
  });
});
