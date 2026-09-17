import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { AdminPrismaRepository, PeriodAdminService } from "../admin/index.js";
import { PeriodPrismaRepository } from "../period/test-seams/index.js";
import { WeeklyReportPrismaRepository } from "../weekly-report/weekly-report.prisma-repository.js";
import { ArchivePrismaRepository } from "./archive.prisma-repository";

// The pair behind the head's Archive / Restore toolbar controls: the same
// service the archive router calls, read back through both list surfaces.
describe("Archive → restore round-trip (integration)", () => {
  const prisma = createTestPrisma();
  // A head reads history through its own reporting group, so the seeded
  // group id is what makes the seeded section visible at all.
  const headSession = {
    userId: TEST_IDS.head,
    role: "head" as const,
    reportingGroupId: TEST_IDS.group,
    viewerGroupAccess: [],
  };

  let archiveRepo: ArchivePrismaRepository;
  let historyRepo: WeeklyReportPrismaRepository;
  let periodRepo: PeriodPrismaRepository;
  let periodAdmin: PeriodAdminService;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    archiveRepo = new ArchivePrismaRepository(prisma as never);
    historyRepo = new WeeklyReportPrismaRepository(prisma as never);
    periodRepo = new PeriodPrismaRepository(prisma as never, historyRepo);
    periodAdmin = new PeriodAdminService(
      new AdminPrismaRepository(prisma as never),
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    // Publishing requires a submitted section; the shared fixture seeds a draft.
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted" },
    });
    const expected = await periodRepo.getReportById(testData.report.id);
    if (!expected) {
      throw new Error(`fixture report ${testData.report.id} was not found`);
    }
    const publication = await periodRepo.publishPeriod(
      testData.report.id,
      testData.head.id,
      expected,
    );
    if (!publication.transitioned) {
      throw new Error(`fixture publication failed: ${publication.reason}`);
    }
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  async function nonArchivedHistoryIds(): Promise<string[]> {
    const { reports } = await historyRepo.getCompiledHistory(
      headSession,
      false,
    );
    return reports.map((report) => report.snapshot.reportId);
  }

  async function archivedIds(): Promise<string[]> {
    const { items } = await archiveRepo.listArchiveReports(
      undefined,
      undefined,
      headSession,
    );
    return items.map((item) => item.reportId);
  }

  it("restoring an archived report returns it to the non-archived list", async () => {
    // Pinned first: without this the post-restore assertion could pass on a
    // list that was empty for an unrelated reason (scope, publish state).
    expect(await nonArchivedHistoryIds()).toEqual([testData.report.id]);

    await periodAdmin.archivePeriod(testData.report.id);

    expect(await archivedIds()).toEqual([testData.report.id]);
    expect(await nonArchivedHistoryIds()).not.toContain(testData.report.id);

    await periodAdmin.unarchivePeriod(testData.report.id);

    expect(await nonArchivedHistoryIds()).toEqual([testData.report.id]);
    expect(await archivedIds()).toEqual([]);
  });

  it("restoring reinstates the published lifecycle state, not a draft one", async () => {
    await periodAdmin.archivePeriod(testData.report.id);

    const restored = await periodAdmin.unarchivePeriod(testData.report.id);

    expect(restored).toEqual({ success: true, periodState: "published" });
    const row = await prisma.report.findUniqueOrThrow({
      where: { id: testData.report.id },
      select: { archived: true, periodState: true, periodStatus: true },
    });
    expect(row).toEqual({
      archived: false,
      periodState: "published",
      periodStatus: "published",
    });
  });
});
