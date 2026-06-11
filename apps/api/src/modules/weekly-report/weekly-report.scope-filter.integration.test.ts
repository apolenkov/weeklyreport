import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository";
import type { WeeklyReportScopeSession } from "./weekly-report.service";

/**
 * UFB-054 / Phase 56-D consumer migration: verify that the
 * weekly-report portfolio derives product ownership from the explicit
 * `GroupProduct` edge (Phase 56-A) rather than the implicit
 * `Project.lead.reportingGroupId` path.
 *
 * Schema constraint B1 (`@@unique([productId])`) means each product
 * belongs to exactly one group. The suite therefore tests:
 *   - head in the product's group sees it (GroupProduct edge present);
 *   - head in a DIFFERENT group does NOT see it (correct scope isolation);
 *   - a project with NO GroupProduct row is invisible to scoped sessions;
 *   - admin session is unscoped and sees every project.
 *
 * Note: the original test expected cross-group sharing (one product in
 * two groups), but that is prevented by the B1 unique constraint
 * introduced in commit b44400b6. Updated 2026-06-11 to match the current
 * schema invariant.
 */
describe("WeeklyReportPrismaRepository — GroupProduct scope filter (integration)", () => {
  const prisma = createTestPrisma();
  let repo: WeeklyReportPrismaRepository;

  // Fixed UUIDs — version digit [1-8] in pos 13, variant [89ab] in pos 17.
  const GROUP_A_ID = "a0000000-0000-4000-a000-0000000000a1";
  const GROUP_B_ID = "a0000000-0000-4000-a000-0000000000a2";
  const HEAD_A_ID = "a0000000-0000-4000-a000-0000000000b1";
  const HEAD_B_ID = "a0000000-0000-4000-a000-0000000000b2";
  const LEAD_A_ID = "a0000000-0000-4000-a000-0000000000c1";
  const PROJECT_ID = "a0000000-0000-4000-a000-0000000000d1";
  const REPORT_ID = "a0000000-0000-4000-a000-0000000000e1";

  function session(
    role: "head",
    reportingGroupId: string,
  ): WeeklyReportScopeSession {
    return { role, reportingGroupId };
  }

  beforeAll(() => {
    repo = new WeeklyReportPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // Two reporting groups (different departments).
    await prisma.reportingGroup.createMany({
      data: [
        { id: GROUP_A_ID, name: "Group A" },
        { id: GROUP_B_ID, name: "Group B" },
      ],
    });

    // One head per group, plus one lead living in group A.
    await prisma.user.createMany({
      data: [
        {
          id: HEAD_A_ID,
          email: "head-a@test.local",
          name: "Head A",
          role: "head",
          samlId: "head-a",
          reportingGroupId: GROUP_A_ID,
        },
        {
          id: HEAD_B_ID,
          email: "head-b@test.local",
          name: "Head B",
          role: "head",
          samlId: "head-b",
          reportingGroupId: GROUP_B_ID,
        },
        {
          id: LEAD_A_ID,
          email: "lead-a@test.local",
          name: "Lead A",
          role: "lead",
          samlId: "lead-a",
          reportingGroupId: GROUP_A_ID,
        },
      ],
    });

    // One project whose lead lives in group A.
    await prisma.project.create({
      data: {
        id: PROJECT_ID,
        name: "Group A Platform",
        leadId: LEAD_A_ID,
      },
    });

    // Assign the project to group A via the explicit GroupProduct edge
    // (B1 constraint: one group per product).
    await prisma.groupProduct.create({
      data: { groupId: GROUP_A_ID, productId: PROJECT_ID },
    });

    // One open report — content does not matter for the portfolio
    // visibility check.
    await prisma.report.create({
      data: {
        id: REPORT_ID,
        periodStart: new Date("2026-05-04"),
        periodEnd: new Date("2026-05-10"),
        deadline: new Date("2026-05-08T15:00:00.000Z"),
        status: "draft",
        periodStatus: "open",
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("head in the product's group sees it via the GroupProduct edge", async () => {
    const result = expectDefined(
      await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_A_ID)),
    );

    const productIds = result.readModel.portfolioOverview.map(
      (p) => p.productId,
    );
    expect(productIds).toContain(PROJECT_ID);
  });

  it("head in a different group does NOT see a product assigned to another group", async () => {
    // Pre-migration the legacy `Project.lead.reportingGroupId` path would
    // have also filtered this out (lead is in group A, not B), so the
    // result is the same — but now the derivation goes through the
    // explicit GroupProduct edge, not through the lead's group membership.
    const result = expectDefined(
      await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_B_ID)),
    );

    const productIds = result.readModel.portfolioOverview.map(
      (p) => p.productId,
    );
    expect(productIds).not.toContain(PROJECT_ID);
  });

  it("a project with NO GroupProduct row is invisible to scoped sessions (regression guard)", async () => {
    // A second project with no GroupProduct edge must be invisible to both
    // heads — visibility comes exclusively from the join.
    const ORPHAN_ID = "a0000000-0000-4000-a000-0000000000d2";
    await prisma.project.create({
      data: {
        id: ORPHAN_ID,
        name: "Orphan Product",
        leadId: LEAD_A_ID,
      },
    });

    const resultA = expectDefined(
      await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_A_ID)),
    );
    const resultB = expectDefined(
      await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_B_ID)),
    );

    expect(
      resultA.readModel.portfolioOverview.map((p) => p.productId),
    ).not.toContain(ORPHAN_ID);
    expect(
      resultB.readModel.portfolioOverview.map((p) => p.productId),
    ).not.toContain(ORPHAN_ID);
  });

  it("admin session is unscoped and sees every project regardless of GroupProduct edges", async () => {
    const ORPHAN_ID = "a0000000-0000-4000-a000-0000000000d3";
    await prisma.project.create({
      data: {
        id: ORPHAN_ID,
        name: "Orphan Product For Admin",
        leadId: LEAD_A_ID,
      },
    });

    const adminSession: WeeklyReportScopeSession = { role: "admin" };
    const result = expectDefined(
      await repo.getWeeklyReport(REPORT_ID, adminSession),
    );

    const ids = result.readModel.portfolioOverview.map((p) => p.productId);
    expect(ids).toContain(PROJECT_ID);
    expect(ids).toContain(ORPHAN_ID);
  });
});
