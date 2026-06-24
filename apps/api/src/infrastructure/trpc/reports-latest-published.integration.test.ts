import type { UserSession } from "@customreport/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { createAppRouter } from "./trpc.router.js";

/**
 * viewer-report-surface-parity (review P3): the stub-prisma test for
 * `reports.latestPublished` pins the WHERE shape but never runs the relation
 * path against Postgres. A wrong relation name or filter that still type-checks
 * would pass the stub test yet mis-scope at runtime. This integration test
 * seeds published / open / reopened reports with in-group and out-of-group
 * sections and asserts the resolver:
 *   - picks the newest PUBLISHED in-group report (periodStatus gate + ordering);
 *   - never lands on a reopened or open period;
 *   - respects the section group filter (out-of-group published is invisible
 *     to a viewer who lacks that group, visible once granted);
 *   - returns null when nothing qualifies.
 */
describe("reports.latestPublished (integration)", () => {
  const prisma = createTestPrisma();

  const GROUP_A_ID = "c0000000-0000-4000-a000-0000000000a1";
  const GROUP_B_ID = "c0000000-0000-4000-a000-0000000000a2";
  const LEAD_A_ID = "c0000000-0000-4000-a000-0000000000c1";
  const LEAD_B_ID = "c0000000-0000-4000-a000-0000000000c2";

  // periodStart ascending: OLD_PUB < OPEN < NEW_PUB_OUT < REOPENED.
  const REPORT_OLD_PUB_A = "c0000000-0000-4000-a000-0000000000e1";
  const REPORT_OPEN_A = "c0000000-0000-4000-a000-0000000000e2";
  const REPORT_NEW_PUB_B = "c0000000-0000-4000-a000-0000000000e3";
  const REPORT_REOPENED_A = "c0000000-0000-4000-a000-0000000000e4";

  async function createReport(
    id: string,
    status: "draft" | "published",
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
    const deps = { prisma } as unknown as Parameters<typeof createAppRouter>[0];
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

  it("resolves the newest PUBLISHED in-group report, skipping the newer reopened and open periods", async () => {
    const result = await viewerCaller([GROUP_A_ID]).reports.latestPublished();
    // REPORT_REOPENED_A is newer but reopened; REPORT_OPEN_A is open;
    // REPORT_NEW_PUB_B is out of group A. Only OLD_PUB_A qualifies.
    expect(result).toEqual({ reportId: REPORT_OLD_PUB_A });
  });

  it("with both groups granted, picks the newest published across groups (ordering + group path)", async () => {
    const result = await viewerCaller([
      GROUP_A_ID,
      GROUP_B_ID,
    ]).reports.latestPublished();
    expect(result).toEqual({ reportId: REPORT_NEW_PUB_B });
  });

  it("returns null when the viewer has no granted groups", async () => {
    const result = await viewerCaller([]).reports.latestPublished();
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
    );
    await createSection(REPORT_NEW_PUB_B, LEAD_B_ID);

    const result = await viewerCaller([GROUP_A_ID]).reports.latestPublished();
    expect(result).toEqual({ reportId: null });
  });
});
