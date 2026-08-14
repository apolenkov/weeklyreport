import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository";
import type { WeeklyReportScopeSession } from "./weekly-report.service";

// Portfolio ownership comes from GroupProduct (one group per product), not lead.reportingGroupId.
describe("WeeklyReportPrismaRepository — GroupProduct scope filter (integration)", () => {
  const prisma = createTestPrisma();
  const repo = new WeeklyReportPrismaRepository(
    prisma as unknown as PrismaService,
  );

  // Fixed UUIDs — version digit [1-8] in pos 13, variant [89ab] in pos 17.
  const GROUP_A_ID = "a0000000-0000-4000-a000-0000000000a1";
  const GROUP_B_ID = "a0000000-0000-4000-a000-0000000000a2";
  const HEAD_A_ID = "a0000000-0000-4000-a000-0000000000b1";
  const HEAD_B_ID = "a0000000-0000-4000-a000-0000000000b2";
  const LEAD_A_ID = "a0000000-0000-4000-a000-0000000000c1";
  const PROJECT_ID = "a0000000-0000-4000-a000-0000000000d1";
  const REPORT_ID = "a0000000-0000-4000-a000-0000000000e1";

  function session(
    role: "head" | "lead",
    reportingGroupId: string,
  ): WeeklyReportScopeSession {
    return {
      userId: "00000000-0000-4000-a000-0000000000e1",
      role,
      reportingGroupId,
    };
  }

  beforeEach(async () => {
    await cleanDatabase();

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
          lastName: "Head",
          firstName: "A",
          role: "head",
          samlId: "head-a",
          reportingGroupId: GROUP_A_ID,
        },
        {
          id: HEAD_B_ID,
          email: "head-b@test.local",
          name: "Head B",
          lastName: "Head",
          firstName: "B",
          role: "head",
          samlId: "head-b",
          reportingGroupId: GROUP_B_ID,
        },
        {
          id: LEAD_A_ID,
          email: "lead-a@test.local",
          name: "Lead A",
          lastName: "Lead",
          firstName: "A",
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
    // (one group per product).
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
    await cleanDatabase();
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
    const result = expectDefined(
      await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_B_ID)),
    );

    const productIds = result.readModel.portfolioOverview.map(
      (p) => p.productId,
    );
    expect(productIds).not.toContain(PROJECT_ID);
  });

  // Lead preview uses the same weeklyReport.get payload as head — group-scoped.
  it("a lead sees only their own group's product, not another group's", async () => {
    const GROUP_B_PRODUCT_ID = "a0000000-0000-4000-a000-0000000000d5";
    await prisma.project.create({
      data: {
        id: GROUP_B_PRODUCT_ID,
        name: "Group B Platform",
        leadId: LEAD_A_ID,
      },
    });
    await prisma.groupProduct.create({
      data: { groupId: GROUP_B_ID, productId: GROUP_B_PRODUCT_ID },
    });

    const result = expectDefined(
      await repo.getWeeklyReport(REPORT_ID, session("lead", GROUP_A_ID)),
    );

    const productIds = result.readModel.portfolioOverview.map(
      (p) => p.productId,
    );
    expect(productIds).toContain(PROJECT_ID);
    expect(productIds).not.toContain(GROUP_B_PRODUCT_ID);
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

    const adminSession: WeeklyReportScopeSession = {
      userId: "00000000-0000-4000-a000-0000000000e2",
      role: "admin",
    };
    const result = expectDefined(
      await repo.getWeeklyReport(REPORT_ID, adminSession),
    );

    const ids = result.readModel.portfolioOverview.map((p) => p.productId);
    expect(ids).toContain(PROJECT_ID);
    expect(ids).toContain(ORPHAN_ID);
  });

  describe("cross-group audit signal (scopeAccessed)", () => {
    const LEAD_B_ID = "a0000000-0000-4000-a000-0000000000c2";
    const CROSS_PROJECT_ID = "a0000000-0000-4000-a000-0000000000d4";
    const SECTION_A_ID = "a0000000-0000-4000-a000-0000000000f1";

    // Lead B owns a product joined to group A — only way it surfaces to head A.
    async function createCrossGroupProduct() {
      await prisma.user.create({
        data: {
          id: LEAD_B_ID,
          email: "lead-b@test.local",
          name: "Lead B",
          lastName: "Lead",
          firstName: "B",
          role: "lead",
          samlId: "lead-b",
          reportingGroupId: GROUP_B_ID,
        },
      });
      await prisma.project.create({
        data: {
          id: CROSS_PROJECT_ID,
          name: "Cross Group Product",
          leadId: LEAD_B_ID,
        },
      });
      await prisma.groupProduct.create({
        data: { groupId: GROUP_A_ID, productId: CROSS_PROJECT_ID },
      });
    }

    // Publish with snapshot; frozen ownerGroupId is the only cross-group source.
    async function publishWithSnapshot(
      surfacedProducts: {
        projectId: string;
        projectName: string;
        ownerGroupId: string | null;
      }[],
    ) {
      await prisma.reportSection.create({
        data: {
          id: SECTION_A_ID,
          reportId: REPORT_ID,
          authorId: LEAD_A_ID,
          status: "submitted",
        },
      });
      await prisma.report.update({
        where: { id: REPORT_ID },
        data: {
          status: "published",
          periodStatus: "published",
          publishedSnapshot: {
            reportId: REPORT_ID,
            periodStart: "2026-05-04T00:00:00.000Z",
            periodEnd: "2026-05-10T00:00:00.000Z",
            deadline: "2026-05-08T15:00:00.000Z",
            status: "published",
            publishedAt: null,
            publishedById: null,
            publishedByName: null,
            portfolioOverview: {
              status: "green",
              totals: { green: surfacedProducts.length, yellow: 0, red: 0 },
            },
            sections: [
              {
                reportSectionId: SECTION_A_ID,
                reportId: REPORT_ID,
                authorId: LEAD_A_ID,
                authorName: "Lead A",
                version: 1,
                status: "submitted",
                submittedAt: null,
                projects: surfacedProducts.map((project) => ({
                  projectId: project.projectId,
                  projectName: project.projectName,
                  ownerGroupId: project.ownerGroupId,
                  trafficLight: "green",
                })),
                items: [],
                risks: [],
                decisions: [],
              },
            ],
          },
        },
      });
    }

    it("own-group-only read yields no signal (crossGroup null)", async () => {
      const result = expectDefined(
        await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_A_ID)),
      );

      expect(result.crossGroup).toBeNull();
    });

    it("a surfaced product owned by another group's lead yields the signal", async () => {
      await createCrossGroupProduct();

      const result = expectDefined(
        await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_A_ID)),
      );

      expect(result.crossGroup).toEqual({
        productIds: [CROSS_PROJECT_ID],
        groupIds: [GROUP_B_ID],
      });
    });

    it("admin read yields no signal even when a cross-group edge exists", async () => {
      await createCrossGroupProduct();

      const adminSession: WeeklyReportScopeSession = {
        userId: "00000000-0000-4000-a000-0000000000e2",
        role: "admin",
      };
      const result = expectDefined(
        await repo.getWeeklyReport(REPORT_ID, adminSession),
      );

      expect(result.crossGroup).toBeNull();
    });

    it("published period: NO signal when the snapshot does not surface the cross-group product", async () => {
      // Live cross-edge exists, but snapshot only shows own-group product —
      // emitting scopeAccessed would be a false audit-trail entry.
      await createCrossGroupProduct();
      await publishWithSnapshot([
        {
          projectId: PROJECT_ID,
          projectName: "Group A Platform",
          ownerGroupId: GROUP_A_ID,
        },
      ]);

      const result = expectDefined(
        await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_A_ID)),
      );

      expect(
        result.readModel.portfolioOverview.map((p) => p.productId),
      ).not.toContain(CROSS_PROJECT_ID);
      expect(result.crossGroup).toBeNull();
    });

    it("published period: signal present when the snapshot DOES surface the cross-group product", async () => {
      await createCrossGroupProduct();
      await publishWithSnapshot([
        {
          projectId: PROJECT_ID,
          projectName: "Group A Platform",
          ownerGroupId: GROUP_A_ID,
        },
        {
          projectId: CROSS_PROJECT_ID,
          projectName: "Cross Group Product",
          ownerGroupId: GROUP_B_ID,
        },
      ]);

      const result = expectDefined(
        await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_A_ID)),
      );

      expect(
        result.readModel.portfolioOverview.map((p) => p.productId),
      ).toContain(CROSS_PROJECT_ID);
      expect(result.crossGroup).toEqual({
        productIds: [CROSS_PROJECT_ID],
        groupIds: [GROUP_B_ID],
      });
    });

    it("published period: cross-group product archived AFTER publish still triggers the signal", async () => {
      // The snapshot delivered the product to head A; archiving the live row
      // afterwards drops it from the `archived: false` live query. Sourcing the
      // signal from the frozen snapshot keeps it named.
      await createCrossGroupProduct();
      await publishWithSnapshot([
        {
          projectId: PROJECT_ID,
          projectName: "Group A Platform",
          ownerGroupId: GROUP_A_ID,
        },
        {
          projectId: CROSS_PROJECT_ID,
          projectName: "Cross Group Product",
          ownerGroupId: GROUP_B_ID,
        },
      ]);
      await prisma.project.update({
        where: { id: CROSS_PROJECT_ID },
        data: { archived: true },
      });

      const result = expectDefined(
        await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_A_ID)),
      );

      // The caller still receives the product via the snapshot…
      expect(
        result.readModel.portfolioOverview.map((p) => p.productId),
      ).toContain(CROSS_PROJECT_ID);
      // …so the audit signal must still name it.
      expect(result.crossGroup).toEqual({
        productIds: [CROSS_PROJECT_ID],
        groupIds: [GROUP_B_ID],
      });
    });

    it("published period: cross-group GroupProduct edge removed AFTER publish still triggers the signal", async () => {
      // The edge that made the product visible to head A is gone from the live
      // tables, so the scoped live query no longer returns it — but the
      // snapshot still delivers it, so the signal must still fire.
      await createCrossGroupProduct();
      await publishWithSnapshot([
        {
          projectId: PROJECT_ID,
          projectName: "Group A Platform",
          ownerGroupId: GROUP_A_ID,
        },
        {
          projectId: CROSS_PROJECT_ID,
          projectName: "Cross Group Product",
          ownerGroupId: GROUP_B_ID,
        },
      ]);
      await prisma.groupProduct.deleteMany({
        where: { productId: CROSS_PROJECT_ID },
      });

      const result = expectDefined(
        await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_A_ID)),
      );

      expect(
        result.readModel.portfolioOverview.map((p) => p.productId),
      ).toContain(CROSS_PROJECT_ID);
      expect(result.crossGroup).toEqual({
        productIds: [CROSS_PROJECT_ID],
        groupIds: [GROUP_B_ID],
      });
    });

    it("published period: an own-group-only read emits no signal and delivers the snapshot products unchanged (regression)", async () => {
      await createCrossGroupProduct();
      await publishWithSnapshot([
        {
          projectId: PROJECT_ID,
          projectName: "Group A Platform",
          ownerGroupId: GROUP_A_ID,
        },
      ]);

      const result = expectDefined(
        await repo.getWeeklyReport(REPORT_ID, session("head", GROUP_A_ID)),
      );

      expect(result.crossGroup).toBeNull();
      // The delivered read model is exactly the snapshot's own-group product —
      // no live cross-group product leaks in, none is dropped.
      expect(
        result.readModel.portfolioOverview.map((p) => p.productId),
      ).toEqual([PROJECT_ID]);
    });
  });
});
