import type { ReportStatus, UserSession } from "@weeklyreport/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createNullLogger } from "../../lib/logger.js";
import {
  WeeklyReportPrismaRepository,
  WeeklyReportService,
} from "../../modules/weekly-report/index.js";
import { createNullAuditLogger } from "../../test-utils/audit-logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
} from "../../test-utils/prisma-test-helper";
import { createStubAppRouterDeps } from "../../test-utils/stub-app-router-deps.js";
import type { PrismaService } from "../prisma/prisma.service";
import { createAppRouter } from "./trpc.router.js";

// Real-Prisma: latestForViewer prefers current editable (viewer-visible
// section via getCurrentEditableId) else newest published else null. Shared
// repository query means the two paths cannot diverge.
describe("reports.latestForViewer (integration)", () => {
  const prisma = createTestPrisma();
  // Real service so getCurrentEditableId() runs the actual Postgres query.
  const repository = new WeeklyReportPrismaRepository(
    prisma as unknown as PrismaService,
  );
  const weeklyReportService = new WeeklyReportService(
    repository,
    createNullLogger(),
  );

  const GROUP_A_ID = "c0000000-0000-4000-a000-0000000000a1";
  const GROUP_B_ID = "c0000000-0000-4000-a000-0000000000a2";
  const LEAD_A_ID = "c0000000-0000-4000-a000-0000000000c1";
  const LEAD_B_ID = "c0000000-0000-4000-a000-0000000000c2";

  // periodStart ascending: OLD_PUB_A < OPEN_A < NEW_PUB_B < REOPENED_A.
  const REPORT_OLD_PUB_A = "c0000000-0000-4000-a000-0000000000e1";
  const REPORT_OPEN_A = "c0000000-0000-4000-a000-0000000000e2";
  const REPORT_NEW_PUB_B = "c0000000-0000-4000-a000-0000000000e3";
  const REPORT_REOPENED_A = "c0000000-0000-4000-a000-0000000000e4";

  async function createReport(
    id: string,
    status: ReportStatus,
    periodStatus: "open" | "published" | "reopened",
    periodStart: string,
    archived = false,
    sectionOwner?: {
      readonly groupId: string;
      readonly authorId: string;
      readonly authorName: string;
    },
  ): Promise<void> {
    const periodEnd = new Date(periodStart);
    const publishedAt = new Date(periodStart);
    await prisma.report.create({
      data: {
        id,
        periodStart: new Date(periodStart),
        periodEnd,
        deadline: new Date(periodStart),
        status,
        periodStatus,
        archived,
        ...(periodStatus !== "open" ? { publishedAt } : {}),
        ...(periodStatus === "reopened" ? { reopenedAt: publishedAt } : {}),
        periodState: archived
          ? "archived"
          : periodStatus === "published"
            ? "published"
            : "open",
        ...(periodStatus !== "open"
          ? {
              publishedSnapshot: publishedSnapshotFixture({
                reportId: id,
                periodStart,
                periodEnd,
                deadline: periodEnd,
                publishedAt,
                sectionOwners: sectionOwner
                  ? [
                      {
                        reportSectionId: id,
                        ...sectionOwner,
                        groupName:
                          sectionOwner.groupId === GROUP_A_ID
                            ? "Group A"
                            : "Group B",
                      },
                    ]
                  : [],
              }),
            }
          : {}),
      },
    });
    if (periodStatus !== "open" && sectionOwner) {
      await prisma.publishedSectionScope.create({
        data: {
          reportId: id,
          reportSectionId: id,
          authorId: sectionOwner.authorId,
          groupId: sectionOwner.groupId,
        },
      });
    }
  }

  async function createSection(
    reportId: string,
    authorId: string,
  ): Promise<void> {
    await prisma.reportSection.create({
      data: { reportId, authorId, status: "submitted" },
    });
  }

  function viewerCaller(viewerGroupAccess: string[]) {
    const session: UserSession = {
      userId: "c0000000-0000-4000-a000-0000000000d1",
      email: "viewer@test.local",
      name: "Viewer",
      role: "viewer",
      viewerGroupAccess,
      activeReportId: null,
      activeReportSectionId: null,
    };
    const deps = createStubAppRouterDeps({
      prisma,
      weeklyReportService,
    });
    return createAppRouter(deps).createCaller({
      session,
      logger: createNullLogger(),
      auditLogger: createNullAuditLogger(),
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    });
  }

  beforeAll(async () => {
    await cleanDatabase();
    await prisma.reportingGroup.createMany({
      data: [
        { id: GROUP_A_ID, name: "Group A" },
        { id: GROUP_B_ID, name: "Group B" },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          id: LEAD_A_ID,
          email: "lead-a@latest.local",
          name: "Lead A",
          lastName: "Lead",
          firstName: "A",
          role: "lead",
          samlId: "latest-lead-a",
          reportingGroupId: GROUP_A_ID,
        },
        {
          id: LEAD_B_ID,
          email: "lead-b@latest.local",
          name: "Lead B",
          lastName: "Lead",
          firstName: "B",
          role: "lead",
          samlId: "latest-lead-b",
          reportingGroupId: GROUP_B_ID,
        },
      ],
    });
  });

  beforeEach(async () => {
    await prisma.reportSection.deleteMany();
    await prisma.report.deleteMany();

    await createReport(
      REPORT_OLD_PUB_A,
      "published",
      "published",
      "2026-05-04T00:00:00.000Z",
      false,
      { groupId: GROUP_A_ID, authorId: LEAD_A_ID, authorName: "Lead A" },
    );
    await createReport(
      REPORT_OPEN_A,
      "draft",
      "open",
      "2026-05-11T00:00:00.000Z",
    );
    await createReport(
      REPORT_NEW_PUB_B,
      "published",
      "published",
      "2026-05-18T00:00:00.000Z",
      false,
      { groupId: GROUP_B_ID, authorId: LEAD_B_ID, authorName: "Lead B" },
    );
    await createReport(
      REPORT_REOPENED_A,
      "published",
      "reopened",
      "2026-05-25T00:00:00.000Z",
      false,
      { groupId: GROUP_A_ID, authorId: LEAD_A_ID, authorName: "Lead A" },
    );

    await createSection(REPORT_OLD_PUB_A, LEAD_A_ID);
    await createSection(REPORT_OPEN_A, LEAD_A_ID);
    await createSection(REPORT_NEW_PUB_B, LEAD_B_ID);
    await createSection(REPORT_REOPENED_A, LEAD_A_ID);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("targets the CURRENT editable period (newest reopened) when it is viewer-visible", async () => {
    // currentEditableId = REPORT_REOPENED_A (newest editable, in group A). The
    // viewer sees it live — NOT the older published OLD_PUB_A.
    const result = await viewerCaller([GROUP_A_ID]).reports.latestForViewer();
    expect(result).toEqual({ reportId: REPORT_REOPENED_A });
  });

  it("falls to the newest visible published when the current editable is out of group", async () => {
    // currentEditableId = REPORT_REOPENED_A (group A only). A group-B viewer
    // cannot see it, so the resolver MUST fall to the newest visible published
    // for group B — never the (invisible) editable period.
    const result = await viewerCaller([GROUP_B_ID]).reports.latestForViewer();
    expect(result).toEqual({ reportId: REPORT_NEW_PUB_B });
  });

  it("returns null when the viewer has no granted groups", async () => {
    const result = await viewerCaller([]).reports.latestForViewer();
    expect(result).toEqual({ reportId: null });
  });

  it("with no editable period, resolves the newest published across granted groups", async () => {
    // Remove the editable periods so the resolver takes the published path.
    await prisma.reportSection.deleteMany({
      where: { reportId: { in: [REPORT_OPEN_A, REPORT_REOPENED_A] } },
    });
    await prisma.report.deleteMany({
      where: { id: { in: [REPORT_OPEN_A, REPORT_REOPENED_A] } },
    });

    const result = await viewerCaller([
      GROUP_A_ID,
      GROUP_B_ID,
    ]).reports.latestForViewer();
    expect(result).toEqual({ reportId: REPORT_NEW_PUB_B });
  });

  it("skips a newer archived published report in favor of a visible fallback", async () => {
    await prisma.reportSection.deleteMany();
    await prisma.report.deleteMany();
    await createReport(
      REPORT_OLD_PUB_A,
      "published",
      "published",
      "2026-05-04T00:00:00.000Z",
      false,
      { groupId: GROUP_A_ID, authorId: LEAD_A_ID, authorName: "Lead A" },
    );
    await createReport(
      REPORT_NEW_PUB_B,
      "published",
      "published",
      "2026-05-25T00:00:00.000Z",
      true,
      { groupId: GROUP_A_ID, authorId: LEAD_A_ID, authorName: "Lead A" },
    );
    await createSection(REPORT_OLD_PUB_A, LEAD_A_ID);
    await createSection(REPORT_NEW_PUB_B, LEAD_A_ID);

    const result = await viewerCaller([GROUP_A_ID]).reports.latestForViewer();
    expect(result).toEqual({ reportId: REPORT_OLD_PUB_A });
  });

  it("returns null when no non-archived visible published report exists", async () => {
    await prisma.reportSection.deleteMany();
    await prisma.report.deleteMany();
    await createReport(
      REPORT_NEW_PUB_B,
      "published",
      "published",
      "2026-05-25T00:00:00.000Z",
      true,
      { groupId: GROUP_A_ID, authorId: LEAD_A_ID, authorName: "Lead A" },
    );
    await createSection(REPORT_NEW_PUB_B, LEAD_A_ID);

    const result = await viewerCaller([GROUP_A_ID]).reports.latestForViewer();
    expect(result).toEqual({ reportId: null });
  });

  it("returns null when the only published report is out of the viewer's groups", async () => {
    await prisma.reportSection.deleteMany();
    await prisma.report.deleteMany();
    await createReport(
      REPORT_NEW_PUB_B,
      "published",
      "published",
      "2026-05-18T00:00:00.000Z",
      false,
      { groupId: GROUP_B_ID, authorId: LEAD_B_ID, authorName: "Lead B" },
    );
    await createSection(REPORT_NEW_PUB_B, LEAD_B_ID);

    const result = await viewerCaller([GROUP_A_ID]).reports.latestForViewer();
    expect(result).toEqual({ reportId: null });
  });
});
