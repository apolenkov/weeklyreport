import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { PeriodPrismaRepository } from "../period/period.prisma-repository.js";
import { WeeklyReportPrismaRepository } from "../weekly-report/weekly-report.prisma-repository.js";
import { ArchivePrismaRepository } from "./archive.prisma-repository";
import { encodeArchiveCursor } from "./archive-cursor.js";

describe("ArchivePrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: ArchivePrismaRepository;
  let periodRepo: PeriodPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new ArchivePrismaRepository(prisma as never);
    periodRepo = new PeriodPrismaRepository(
      prisma as never,
      new WeeklyReportPrismaRepository(prisma as never),
    );
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
    expect(emptyList.items).toHaveLength(0);

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

    const list = (await repo.listArchiveReports()).items;
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
    const list = (await repo.listArchiveReports()).items;
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

    const list = (await repo.listArchiveReports()).items;
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

    // The archive summary now derives from the assignment-scoped read model
    // (same as the detail / live total), so the product must be OWNED to be
    // counted — a bare ProjectStatus with no stage assignment is excluded.
    const stage = await prisma.stage.create({
      data: {
        id: "a0000000-0000-4000-a000-000000000aa4",
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

  it("W6: archive summary floors a no-snapshot report by an own covering risk", async () => {
    // Published + archived WITHOUT a stored snapshot (seed / legacy shape), so
    // the summary takes the read-model fallback. The lead owns a stage with NO
    // submitted status; a stale green ProjectStatus would read green — but the
    // lead's own covers-all blocked risk must floor the archive total to red,
    // and the summary must agree with the detail.
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        publishedAt: new Date("2026-04-12T10:00:00.000Z"),
        publishedById: testData.head.id,
        archived: true,
      },
    });
    const stage = await prisma.stage.create({
      data: {
        id: "a0000000-0000-4000-a000-000000000aa5",
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
    // Stale green ProjectStatus, NO StageStatus (owned stage left empty).
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });
    await prisma.risk.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        risk: "Own covering risk",
        impact: "High",
        mitigation: "Mitigate",
        severity: "blocked",
        stageNames: [], // covers-all
      },
    });

    const detail = await repo.getArchiveReport(testData.report.id);

    expect(detail).not.toBeNull();
    // Floored to red by the own covering risk, not the stale green ProjectStatus.
    expect(expectDefined(detail).summary.portfolioStatus).toBe("red");
    // Summary and detail agree (same floored, assignment-scoped read model).
    expect(expectDefined(detail).report.portfolioOverview.status).toBe("red");
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

  async function createArchivedReport(
    publishedAt: Date,
    periodEnd: Date = publishedAt,
  ): Promise<{ id: string; publishedAt: Date }> {
    const report = await prisma.report.create({
      data: {
        // Distinct period window per row — Report has a unique
        // (periodStart, periodEnd) constraint.
        periodStart: new Date(periodEnd.getTime() - 6 * 86_400_000),
        periodEnd,
        deadline: periodEnd,
        status: "published",
        publishedAt,
        publishedById: testData.head.id,
        archived: true,
      },
    });
    const section = await prisma.reportSection.create({
      data: {
        reportId: report.id,
        authorId: testData.lead.id,
        status: "submitted",
      },
    });
    await prisma.projectStatus.create({
      data: {
        reportSectionId: section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });
    return { id: report.id, publishedAt };
  }

  it("paginates the archive with a keyset cursor (page + probe row)", async () => {
    // The seeded report stays draft, so only these three archived rows appear.
    const older = await createArchivedReport(
      new Date("2026-04-01T10:00:00.000Z"),
    );
    const middle = await createArchivedReport(
      new Date("2026-04-08T10:00:00.000Z"),
    );
    const newest = await createArchivedReport(
      new Date("2026-04-15T10:00:00.000Z"),
    );

    const page1 = await repo.listArchiveReports({ limit: 2 });
    expect(page1.items.map((r) => r.reportId)).toEqual([newest.id, middle.id]);
    // A probe row (older) exists beyond the page, so nextCursor is the last
    // kept row's encoded (publishedAt, id) keyset coordinate.
    expect(page1.nextCursor).toBe(
      encodeArchiveCursor(middle.publishedAt, middle.id),
    );

    const page2 = await repo.listArchiveReports({
      limit: 2,
      cursor: expectDefined(page1.nextCursor),
    });
    expect(page2.items.map((r) => r.reportId)).toEqual([older.id]);
    // Last page: no probe row, so nextCursor is null.
    expect(page2.nextCursor).toBeNull();

    // A page that covers everything also returns a null cursor.
    const whole = await repo.listArchiveReports({ limit: 10 });
    expect(whole.items).toHaveLength(3);
    expect(whole.nextCursor).toBeNull();
  });

  it("keyset cursor pages across rows that share a publishedAt (id tiebreaker)", async () => {
    // Two rows with the SAME publishedAt exercise the tiebreaker branch of the
    // keyset predicate (`publishedAt = cursor AND id < cursorId`). Distinct
    // period windows keep the unique (periodStart, periodEnd) constraint happy.
    const sharedPublishedAt = new Date("2026-05-01T10:00:00.000Z");
    const first = await createArchivedReport(
      sharedPublishedAt,
      new Date("2026-05-01T00:00:00.000Z"),
    );
    const second = await createArchivedReport(
      sharedPublishedAt,
      new Date("2026-05-08T00:00:00.000Z"),
    );

    const page1 = await repo.listArchiveReports({ limit: 1 });
    const firstPageId = expectDefined(page1.items[0]).reportId;
    expect([first.id, second.id]).toContain(firstPageId);

    const page2 = await repo.listArchiveReports({
      limit: 1,
      cursor: expectDefined(page1.nextCursor),
    });
    const secondPageId = expectDefined(page2.items[0]).reportId;

    // Both tie rows come back exactly once across the two pages: a wrong or
    // missing `id` tiebreaker would empty, skip, or repeat the second page.
    expect(new Set([firstPageId, secondPageId])).toEqual(
      new Set([first.id, second.id]),
    );
    expect(page2.nextCursor).toBeNull();
  });

  it("rejects a malformed pagination cursor instead of silently restarting", async () => {
    // A present-but-undecodable cursor must fail loud (400), not degrade to a
    // first-page read that could loop a client resending the bad token.
    const malformed = Buffer.from("not-a-keyset-token", "utf8").toString(
      "base64",
    );
    await expect(
      repo.listArchiveReports({ limit: 2, cursor: malformed }),
    ).rejects.toThrow("Malformed archive pagination cursor");
  });
});
