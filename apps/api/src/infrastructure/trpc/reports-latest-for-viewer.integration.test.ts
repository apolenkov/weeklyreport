import type { ReportStatus, UserSession } from "@customreport/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { WeeklyReportPrismaRepository } from "../../modules/weekly-report/weekly-report.prisma-repository.js";
import { WeeklyReportService } from "../../modules/weekly-report/weekly-report.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import type { PrismaService } from "../prisma/prisma.service";
import { createAppRouter } from "./trpc.router.js";

/**
 * viewer-live-status (task 1.2): real-Prisma coverage for the Status-target
 * resolver `reports.latestForViewer`. Adapted from the former
 * `reports-latest-published.integration.test.ts` — it keeps the section-scope
 * relation coverage but asserts the NEW semantics: the resolver targets the
 * current editable period (when it has a viewer-visible section, resolved
 * through the real `getCurrentEditableId()` query), else the newest
 * viewer-visible published report, else null. The current-editable id and the
 * resolver share one repository query, so this also proves they cannot diverge.
 */
describe("reports.latestForViewer (integration)", () => {
  const prisma = createTestPrisma();
  // Real service so getCurrentEditableId() runs the actual Postgres query.
  const repository = new WeeklyReportPrismaRepository(
    prisma as unknown as PrismaService,
  );
  const weeklyReportService = new WeeklyReportService(repository);

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
  ): Promise<void> {
    await prisma.report.create({
      data: {
        id,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodStart),
        deadline: new Date(periodStart),
        status,
        periodStatus,
      },
    });
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
    const deps = {
      prisma,
      weeklyReportService,
    } as unknown as Parameters<typeof createAppRouter>[0];
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
    await cleanDatabase(prisma);
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
    );
    await createReport(
      REPORT_REOPENED_A,
      "published",
      "reopened",
      "2026-05-25T00:00:00.000Z",
    );

    await createSection(REPORT_OLD_PUB_A, LEAD_A_ID);
    await createSection(REPORT_OPEN_A, LEAD_A_ID);
    await createSection(REPORT_NEW_PUB_B, LEAD_B_ID);
    await createSection(REPORT_REOPENED_A, LEAD_A_ID);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
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

  it("returns null when the only published report is out of the viewer's groups", async () => {
    await prisma.reportSection.deleteMany();
    await prisma.report.deleteMany();
    await createReport(
      REPORT_NEW_PUB_B,
      "published",
      "published",
      "2026-05-18T00:00:00.000Z",
    );
    await createSection(REPORT_NEW_PUB_B, LEAD_B_ID);

    const result = await viewerCaller([GROUP_A_ID]).reports.latestForViewer();
    expect(result).toEqual({ reportId: null });
  });
});
