import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { PeriodPrismaRepository } from "../period/test-seams/index.js";
import { WeeklyReportPrismaRepository } from "../weekly-report/weekly-report.prisma-repository.js";
import { ArchivePrismaRepository } from "./archive.prisma-repository";
import type { ArchiveScopeSession } from "./archive.service.js";
import { encodeArchiveCursor } from "./archive-cursor.js";

describe("ArchivePrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: ArchivePrismaRepository;
  let periodRepo: PeriodPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  const adminSession: ArchiveScopeSession = {
    role: "admin",
    viewerGroupAccess: [],
  };

  beforeAll(() => {
    repo = new ArchivePrismaRepository(prisma as never);
    periodRepo = new PeriodPrismaRepository(
      prisma as never,
      new WeeklyReportPrismaRepository(prisma as never),
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("listArchiveReports returns only published reports", async () => {
    // The seeded report is draft, so archive should be empty
    const emptyList = await repo.listArchiveReports(
      undefined,
      undefined,
      adminSession,
    );
    expect(emptyList.items).toHaveLength(0);

    // Archive visibility requires both published state and explicit archival.
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        publishedSnapshot: publishedSnapshotFixture({
          reportId: testData.report.id,
          periodStart: testData.report.periodStart,
          periodEnd: testData.report.periodEnd,
          deadline: testData.report.deadline,
          publishedAt: new Date("2026-04-12T10:00:00.000Z"),
          publishedById: testData.head.id,
          publishedByName: testData.head.name,
        }),
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

    const list = (
      await repo.listArchiveReports(undefined, undefined, adminSession)
    ).items;
    expect(list).toHaveLength(1);
    expect(expectDefined(list[0]).reportId).toBe(testData.report.id);
    expect(expectDefined(list[0]).publishedByName).toBe("Test Head");
    expect(expectDefined(list[0]).portfolioStatus).toBe("green");
  });

  it("rejects an archived draft when a caller filter requests drafts", async () => {
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { archived: true, periodState: "archived" },
    });
    const filter = { status: "draft" } as const;

    const list = await repo.listArchiveReports(undefined, filter, adminSession);
    const detail = await repo.getArchiveReport(
      testData.report.id,
      filter,
      adminSession,
    );

    expect(list.items).toEqual([]);
    expect(detail.detail).toBeNull();
    expect(detail.totalSectionCount).toBe(0);
  });

  it("excludes published reports that were not archived", async () => {
    // Publish the report WITHOUT setting archived=true
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        publishedSnapshot: publishedSnapshotFixture({
          reportId: testData.report.id,
          periodStart: testData.report.periodStart,
          periodEnd: testData.report.periodEnd,
          deadline: testData.report.deadline,
          publishedAt: new Date("2026-04-12T10:00:00.000Z"),
          publishedById: testData.head.id,
          publishedByName: testData.head.name,
        }),
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

    // Published alone is insufficient; archival is an explicit transition.
    const list = (
      await repo.listArchiveReports(undefined, undefined, adminSession)
    ).items;
    expect(list).toHaveLength(0);
  });

  it("includes reports that are both published and archived", async () => {
    // Publish and explicitly archive the report
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        publishedSnapshot: publishedSnapshotFixture({
          reportId: testData.report.id,
          periodStart: testData.report.periodStart,
          periodEnd: testData.report.periodEnd,
          deadline: testData.report.deadline,
          publishedAt: new Date("2026-04-12T10:00:00.000Z"),
          publishedById: testData.head.id,
          publishedByName: testData.head.name,
        }),
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

    const list = (
      await repo.listArchiveReports(undefined, undefined, adminSession)
    ).items;
    expect(list).toHaveLength(1);
    expect(expectDefined(list[0]).reportId).toBe(testData.report.id);
  });

  it("getArchiveReport returns full detail for published report", async () => {
    // The archive summary derives from the assignment-scoped read model (same
    // as the detail / live total), so the product must be OWNED to be
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
        stageNames: ["Development"],
      },
    });

    // Archive detail is available only after the explicit archive transition.
    await periodRepo.publishPeriod(testData.report.id, testData.head.id);
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { archived: true, periodState: "archived" },
    });

    const detail = await repo.getArchiveReport(
      testData.report.id,
      undefined,
      adminSession,
    );

    expect(detail.detail).not.toBeNull();
    expect(expectDefined(detail.detail).summary.reportId).toBe(
      testData.report.id,
    );
    expect(expectDefined(detail.detail).summary.portfolioStatus).toBe("yellow");
    expect(expectDefined(detail.detail).report.sections).toHaveLength(1);
    expect(
      expectDefined(expectDefined(detail.detail).report.sections[0]).items,
    ).toHaveLength(1);
    expect(
      expectDefined(
        expectDefined(expectDefined(detail.detail).report.sections[0]).items[0],
      ).text,
    ).toBe("Archive item");
  });

  it("rejects publishing an archived report without a snapshot", async () => {
    await expect(
      prisma.report.update({
        where: { id: testData.report.id },
        data: {
          status: "published",
          publishedAt: new Date("2026-04-12T10:00:00.000Z"),
          publishedById: testData.head.id,
          archived: true,
        },
      }),
    ).rejects.toThrow(/Report_published_requires_snapshot/);
    await expect(
      prisma.report.findUnique({ where: { id: testData.report.id } }),
    ).resolves.toMatchObject({ status: "draft", publishedSnapshot: null });
  });

  it("rejects a published report without a publication timestamp", async () => {
    const publishedAt = new Date("2026-04-12T10:00:00.000Z");
    await expect(
      prisma.report.update({
        where: { id: testData.report.id },
        data: {
          status: "published",
          publishedAt: null,
          publishedById: testData.head.id,
          publishedSnapshot: publishedSnapshotFixture({
            reportId: testData.report.id,
            periodStart: testData.report.periodStart,
            periodEnd: testData.report.periodEnd,
            publishedAt,
            publishedById: testData.head.id,
            publishedByName: testData.head.name,
          }),
        },
      }),
    ).rejects.toThrow(/Report_published_requires_snapshot/);
    await expect(
      prisma.report.findUnique({ where: { id: testData.report.id } }),
    ).resolves.toMatchObject({ status: "draft", publishedAt: null });
  });

  it("reads the publish-time snapshot after later draft edits", async () => {
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
        stageNames: ["Development"],
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

    const detail = await repo.getArchiveReport(
      testData.report.id,
      undefined,
      adminSession,
    );

    expect(detail.detail).not.toBeNull();
    expect(expectDefined(detail.detail).summary.portfolioStatus).toBe("yellow");
    expect(
      expectDefined(
        expectDefined(expectDefined(detail.detail).report.sections[0]).items[0],
      ).text,
    ).toBe("Published snapshot item");
  });

  async function createArchivedReport(
    publishedAt: Date,
    periodEnd: Date = publishedAt,
  ): Promise<{ id: string; publishedAt: Date }> {
    const reportId = randomUUID();
    const periodStart = new Date(periodEnd.getTime() - 6 * 86_400_000);
    const report = await prisma.report.create({
      data: {
        id: reportId,
        // Archived rows do not participate in the live-period range
        // constraint, but still carry the complete current lifecycle fields.
        periodStart,
        periodEnd,
        deadline: periodEnd,
        status: "published",
        periodState: "archived",
        periodStatus: "published",
        publishedAt,
        publishedById: testData.head.id,
        publishedSnapshot: publishedSnapshotFixture({
          reportId,
          periodStart,
          periodEnd,
          deadline: periodEnd,
          publishedAt,
          publishedById: testData.head.id,
          publishedByName: testData.head.name,
        }),
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

    const page1 = await repo.listArchiveReports(
      { limit: 2 },
      undefined,
      adminSession,
    );
    expect(page1.items.map((r) => r.reportId)).toEqual([newest.id, middle.id]);
    // A probe row (older) exists beyond the page, so nextCursor is the last
    // kept row's encoded (publishedAt, id) keyset coordinate.
    expect(page1.nextCursor).toBe(
      encodeArchiveCursor(middle.publishedAt, middle.id),
    );

    const page2 = await repo.listArchiveReports(
      {
        limit: 2,
        cursor: expectDefined(page1.nextCursor),
      },
      undefined,
      adminSession,
    );
    expect(page2.items.map((r) => r.reportId)).toEqual([older.id]);
    // Last page: no probe row, so nextCursor is null.
    expect(page2.nextCursor).toBeNull();

    // A page that covers everything also returns a null cursor.
    const whole = await repo.listArchiveReports(
      { limit: 10 },
      undefined,
      adminSession,
    );
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

    const page1 = await repo.listArchiveReports(
      { limit: 1 },
      undefined,
      adminSession,
    );
    const firstPageId = expectDefined(page1.items[0]).reportId;
    expect([first.id, second.id]).toContain(firstPageId);

    const page2 = await repo.listArchiveReports(
      {
        limit: 1,
        cursor: expectDefined(page1.nextCursor),
      },
      undefined,
      adminSession,
    );
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
      repo.listArchiveReports(
        { limit: 2, cursor: malformed },
        undefined,
        adminSession,
      ),
    ).rejects.toThrow("Malformed archive pagination cursor");
  });

  const groupBId = "a0000000-0000-4000-a000-000000000b01";
  const leadBId = "a0000000-0000-4000-a000-000000000b02";
  const sessionA: ArchiveScopeSession = {
    role: "lead",
    reportingGroupId: TEST_IDS.group,
  };
  const sessionB: ArchiveScopeSession = {
    role: "head",
    reportingGroupId: groupBId,
  };

  // The second group is red while the seeded group is green, so a scoped read
  // must derive its portfolio from only the caller's group.
  async function seedCrossGroupSections(): Promise<{ sectionBId: string }> {
    const projectBId = "a0000000-0000-4000-a000-000000000b03";
    const stageAId = "a0000000-0000-4000-a000-000000000b04";
    const stageBId = "a0000000-0000-4000-a000-000000000b05";

    await prisma.reportingGroup.create({
      data: { id: groupBId, name: "Group B", description: null },
    });
    await prisma.user.create({
      data: {
        id: leadBId,
        email: "lead-b-archive@test.local",
        name: "Lead B Archive",
        lastName: "Lead",
        firstName: "B",
        role: "lead",
        samlId: "lead-b-archive",
        reportingGroupId: groupBId,
      },
    });
    await prisma.project.create({
      data: { id: projectBId, name: "Project B", leadId: leadBId },
    });
    await prisma.groupProduct.create({
      data: { groupId: groupBId, productId: projectBId },
    });
    const sectionB = await prisma.reportSection.create({
      data: {
        reportId: testData.report.id,
        authorId: leadBId,
        status: "submitted",
      },
    });
    await prisma.stage.createMany({
      data: [
        { id: stageAId, name: "Stage A", sortOrder: 1 },
        { id: stageBId, name: "Stage B", sortOrder: 2 },
      ],
    });

    // Group A: owned stage + a green ProjectStatus, no covering risk → green.
    await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        projectId: testData.project.id,
        stageId: stageAId,
      },
    });
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });

    // Group B: owned stage floored by a blocked own risk → red.
    await prisma.stageAssignment.create({
      data: { userId: leadBId, projectId: projectBId, stageId: stageBId },
    });
    await prisma.risk.create({
      data: {
        reportSectionId: sectionB.id,
        projectId: projectBId,
        risk: "Blocking risk",
        impact: "High",
        mitigation: "None",
        severity: "blocked",
        // Keep the risk scoped to the stage owned by this product.  The
        // current-only contract does not treat a differently named stage as a
        // portfolio-wide risk.
        stageNames: ["Stage B"],
      },
    });

    return { sectionBId: sectionB.id };
  }

  it("snapshot path: a group-scoped session reads only its own group's sections and portfolio", async () => {
    const { sectionBId } = await seedCrossGroupSections();
    // Publish to persist a snapshot spanning BOTH groups, then archive it.
    await periodRepo.publishPeriod(testData.report.id, testData.head.id);
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { archived: true, periodState: "archived" },
    });

    const detailA = await repo.getArchiveReport(
      testData.report.id,
      undefined,
      sessionA,
    );
    expect(detailA.detail).not.toBeNull();
    expect(expectDefined(detailA.detail).report.sections).toHaveLength(1);
    expect(
      expectDefined(expectDefined(detailA.detail).report.sections[0])
        .reportSectionId,
    ).toBe(testData.section.id);
    expect(expectDefined(detailA.detail).report.portfolioOverview.status).toBe(
      "green",
    );
    expect(expectDefined(detailA.detail).summary.portfolioStatus).toBe("green");

    // The list path recomputes the summary from the same scoped snapshot.
    const listA = await repo.listArchiveReports(undefined, undefined, sessionA);
    expect(
      expectDefined(listA.items.find((r) => r.reportId === testData.report.id))
        .portfolioStatus,
    ).toBe("green");

    // Symmetric: a session scoped to group B sees only group B's red section.
    const detailB = await repo.getArchiveReport(
      testData.report.id,
      undefined,
      sessionB,
    );
    expect(expectDefined(detailB.detail).report.sections).toHaveLength(1);
    expect(
      expectDefined(expectDefined(detailB.detail).report.sections[0])
        .reportSectionId,
    ).toBe(sectionBId);
    expect(expectDefined(detailB.detail).report.portfolioOverview.status).toBe(
      "red",
    );
  });

  it("rejects publishing a scoped archive row without a snapshot", async () => {
    await seedCrossGroupSections();
    await expect(
      prisma.report.update({
        where: { id: testData.report.id },
        data: {
          status: "published",
          publishedAt: new Date("2026-04-12T10:00:00.000Z"),
          publishedById: testData.head.id,
          archived: true,
        },
      }),
    ).rejects.toThrow(/Report_published_requires_snapshot/);
    await expect(
      prisma.report.findUnique({ where: { id: testData.report.id } }),
    ).resolves.toMatchObject({ status: "draft", publishedSnapshot: null });
  });
});
