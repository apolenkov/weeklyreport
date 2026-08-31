import { draftSaveSchema, type UserSession } from "@customreport/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper.js";
import { canReadReport } from "../../test-utils/report-read-access.js";
import { AdminPrismaRepository } from "../admin/index.js";
import { PeriodPrismaRepository } from "../period/test-seams/index.js";
import { findPublishedRecordViolation } from "../report-sections/domain/published-record-guard.js";
import { queryPublishedLineage } from "../report-sections/infrastructure/published-lineage.query.js";
import { SearchPrismaRepository } from "../search/infrastructure/search.prisma-repository.js";
import { WeeklyReportPrismaRepository } from "../weekly-report/weekly-report.prisma-repository.js";
import { ArchivePrismaRepository } from "./archive.prisma-repository.js";

describe("published snapshot scope after admin restore (integration)", () => {
  const prisma = createTestPrisma();
  let adminRepository: AdminPrismaRepository;
  let weeklyRepository: WeeklyReportPrismaRepository;
  let archiveRepository: ArchivePrismaRepository;
  let periodRepository: PeriodPrismaRepository;
  let searchRepository: SearchPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  let frozenItemId: string;
  let frozenItemStableId: string;

  const headSession: UserSession = {
    userId: TEST_IDS.head,
    email: "head@restore.test",
    name: "Restore Head",
    role: "head",
    reportingGroupId: TEST_IDS.group,
  };
  const leadSession: UserSession = {
    userId: TEST_IDS.lead,
    email: "lead@restore.test",
    name: "Restore Lead",
    role: "lead",
    reportingGroupId: TEST_IDS.group,
  };
  const viewerSession: UserSession = {
    userId: "99999999-9999-4999-8999-999999999999",
    email: "viewer@restore.test",
    name: "Restore Viewer",
    role: "viewer",
    viewerGroupAccess: [TEST_IDS.group],
  };

  beforeAll(() => {
    weeklyRepository = new WeeklyReportPrismaRepository(prisma as never);
    archiveRepository = new ArchivePrismaRepository(prisma as never);
    periodRepository = new PeriodPrismaRepository(
      prisma as never,
      weeklyRepository,
    );
    adminRepository = new AdminPrismaRepository(prisma as never);
    searchRepository = new SearchPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    const frozenItem = await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "restoresearchtoken immutable publication",
        tag: "general",
        workflowStatus: "in_progress",
        stageNames: ["Development"],
      },
    });
    frozenItemId = frozenItem.id;
    frozenItemStableId = frozenItem.stableId;
    const publication = await periodRepository.publishPeriod(
      testData.report.id,
      testData.head.id,
    );
    if (!publication.transitioned) {
      throw new Error(`fixture publication failed: ${publication.reason}`);
    }
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { archived: true, periodState: "archived" },
    });

    const snapshot = await adminRepository.getSnapshot();
    await prisma.reportSection.deleteMany({
      where: { reportId: testData.report.id },
    });
    await prisma.report.delete({ where: { id: testData.report.id } });
    await adminRepository.saveSnapshot(snapshot);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("keeps weekly, archive, history, and PDF scope readable without live sections", async () => {
    await expect(
      prisma.reportSection.count({ where: { reportId: testData.report.id } }),
    ).resolves.toBe(0);

    for (const session of [viewerSession, headSession, leadSession]) {
      const weekly = await weeklyRepository.getWeeklyReport(
        testData.report.id,
        session,
      );
      expect(weekly?.readModel.leadSections).toHaveLength(1);
      expect(weekly?.readModel.leadSections[0]).toMatchObject({
        authorId: TEST_IDS.lead,
        groupId: TEST_IDS.group,
        groupName: "Test Group",
      });
      await expect(
        canReadReport(session, testData.report.id, prisma as never),
      ).resolves.toBe(true);
    }

    const archive = await archiveRepository.getArchiveReport(
      testData.report.id,
      undefined,
      viewerSession,
    );
    expect(archive.detail?.report.sections).toHaveLength(1);
    expect(archive.totalSectionCount).toBe(1);

    const history = await weeklyRepository.getCompiledHistory(
      leadSession,
      true,
    );
    expect(history.reports[0]?.snapshot.sections).toHaveLength(1);
    expect(history.reports[0]?.snapshot.sections[0]?.authorId).toBe(
      TEST_IDS.lead,
    );
  });

  it("rebuilds frozen scope and indexed search rows without a live graph", async () => {
    await expect(
      prisma.publishedSectionScope.count({
        where: { reportId: testData.report.id },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.publishedSearchDocument.count({
        where: { reportId: testData.report.id },
      }),
    ).resolves.toBe(1);

    const hits = await searchRepository.search({
      q: "restoresearchtoken",
      scope: "published",
      userId: viewerSession.userId,
      groupIds: [TEST_IDS.group],
      excludeTypes: ["project"],
      limit: 20,
    });
    expect(hits).toEqual([
      expect.objectContaining({
        id: frozenItemId,
        reportId: testData.report.id,
        reportSectionId: testData.section.id,
        title: "restoresearchtoken immutable publication",
      }),
    ]);
  });

  it("keeps search scope frozen after the live author changes group", async () => {
    const otherGroup = await prisma.reportingGroup.create({
      data: {
        id: "99999999-9999-4999-8999-999999999998",
        name: "Other Group",
      },
    });
    await prisma.user.update({
      where: { id: TEST_IDS.lead },
      data: { reportingGroupId: otherGroup.id },
    });

    const oldGroupHits = await searchRepository.search({
      q: "restoresearchtoken",
      scope: "published",
      userId: viewerSession.userId,
      groupIds: [TEST_IDS.group],
      excludeTypes: ["project"],
      limit: 20,
    });
    const newGroupHits = await searchRepository.search({
      q: "restoresearchtoken",
      scope: "published",
      userId: viewerSession.userId,
      groupIds: [otherGroup.id],
      excludeTypes: ["project"],
      limit: 20,
    });

    expect(oldGroupHits.map(({ id }) => id)).toEqual([frozenItemId]);
    expect(newGroupHits).toEqual([]);
  });

  it("still denies a viewer after current grants are removed", async () => {
    const revokedViewer = { ...viewerSession, viewerGroupAccess: [] };

    await expect(
      canReadReport(revokedViewer, testData.report.id, prisma as never),
    ).resolves.toBe(false);
    const weekly = await weeklyRepository.getWeeklyReport(
      testData.report.id,
      revokedViewer,
    );
    // Published admission is fail-closed: a revoked viewer must not receive
    // an observable empty report envelope, even though the frozen snapshot
    // remains intact for still-authorized readers.
    expect(weekly).toBeNull();
  });

  it("keeps a restored closed snapshot's carried stableId protected without live records", async () => {
    await expect(
      prisma.item.count({ where: { stableId: frozenItemStableId } }),
    ).resolves.toBe(0);

    const published = await queryPublishedLineage(prisma as never, {
      reportId: "99999999-9999-4999-8999-999999999991",
      reportSectionId: "99999999-9999-4999-8999-999999999992",
      itemStableIds: [frozenItemStableId],
      decisionStableIds: [],
    });
    expect(published.itemStableIds).toEqual([frozenItemStableId]);

    const payload = draftSaveSchema.parse({
      reportSectionId: "99999999-9999-4999-8999-999999999992",
      version: 1,
      status: "draft",
      projectStatuses: [],
      activityStatuses: [],
      items: [],
      risks: [],
      decisions: [],
    });
    expect(findPublishedRecordViolation(published, payload)).toMatchObject({
      code: "PUBLISHED_RECORD_LOCKED",
    });
  });
});
