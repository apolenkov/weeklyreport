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
 * weekly-report portfolio now derives product ownership from the
 * explicit `GroupProduct` M:M edge (Phase 56-A) rather than the
 * implicit `Project.lead.reportingGroupId` path.
 *
 * Concretely:
 *   - one Project owned by lead-in-group-A
 *   - two GroupProduct rows attaching that Project to BOTH group A and
 *     group B (cross-departmental)
 *   - head-A and head-B both run getWeeklyReport against the same
 *     report
 *
 * Pre-migration this test would have failed for head-B: legacy
 * derivation goes through `Project.lead.reportingGroupId.in [B]`
 * which excludes a project whose lead lives in group A. Post-migration
 * the join surfaces it for both heads.
 */
describe("WeeklyReportPrismaRepository — cross-group GroupProduct visibility (integration)", () => {
  const prisma = createTestPrisma();
  let repo: WeeklyReportPrismaRepository;

  // Fixed UUIDs — both versions [1-8] in pos 13 and [89ab] in pos 17.
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

    // One project. Lead lives in group A — the legacy path would
    // attribute the project to group A only.
    await prisma.project.create({
      data: {
        id: PROJECT_ID,
        name: "Cross-Department Platform",
        leadId: LEAD_A_ID,
      },
    });

    // Explicit M:M edges attach the project to BOTH groups. After the
    // Phase 56-D flag flip the portfolio derivation goes through this
    // table, not through `Project.lead.reportingGroupId`.
    await prisma.groupProduct.createMany({
      data: [
        { groupId: GROUP_A_ID, productId: PROJECT_ID },
        { groupId: GROUP_B_ID, productId: PROJECT_ID },
      ],
    });

    // One open report — content does not matter for the portfolio
    // visibility check; we only care which projects make it into the
    // findMany result for each session.
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

  it("head in the lead's group sees the cross-attached product", async () => {
    const result = expectDefined(
      await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_A_ID)),
    );

    const productIds = result.portfolioOverview.map((p) => p.productId);
    expect(productIds).toContain(PROJECT_ID);
  });

  it("head in a different group (no lead in their group) ALSO sees the product via GroupProduct", async () => {
    // Pre-migration this assertion would have failed: head-B's group
    // does not own any User row that leads PROJECT_ID, so the legacy
    // `Project.lead.reportingGroupId.in [GROUP_B]` filter would have
    // returned zero projects.
    const result = expectDefined(
      await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_B_ID)),
    );

    const productIds = result.portfolioOverview.map((p) => p.productId);
    expect(productIds).toContain(PROJECT_ID);
  });

  it("a project with NO GroupProduct row is invisible to scoped sessions (regression guard)", async () => {
    // Create a second project that has no GroupProduct edges at all.
    // Under the explicit-M:M path it must be invisible to both heads,
    // since visibility now comes exclusively from the join.
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

    expect(resultA.portfolioOverview.map((p) => p.productId)).not.toContain(
      ORPHAN_ID,
    );
    expect(resultB.portfolioOverview.map((p) => p.productId)).not.toContain(
      ORPHAN_ID,
    );
  });

  it("admin session is unscoped and sees both products", async () => {
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

    const ids = result.portfolioOverview.map((p) => p.productId);
    expect(ids).toContain(PROJECT_ID);
    expect(ids).toContain(ORPHAN_ID);
  });
});
