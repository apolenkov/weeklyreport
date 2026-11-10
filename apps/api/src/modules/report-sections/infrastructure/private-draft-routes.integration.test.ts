// TASK-836 / 3.8: current entitlement at the real router → service → SQL boundary.
import type { Role } from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { createLeadFormRouter } from "../../../infrastructure/trpc/routers/lead-form.router.js";
import { createReportsRouter } from "../../../infrastructure/trpc/routers/reports.router.js";
import { createNullLogger } from "../../../lib/logger.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import { LeadFormService } from "../application/lead-form.service.js";
import { ReportSectionsService } from "../application/report-sections.service.js";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "../application/report-sections-telemetry.port.js";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository.js";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository.js";

const STAGE_ID = "a0000000-0000-4000-a000-000000000aa1";
const PRIVATE_RISK = "Private vendor draft";
const PRIVATE_DECISION = "Private vendor choice";
const PRIVATE_COMMENT = "Private reviewer context";

describe("private draft route entitlement (PostgreSQL integration)", () => {
  const prisma = createTestPrisma();
  const injection = prisma as unknown as PrismaService;
  const reportSectionsService = new ReportSectionsService(
    new ReportSectionsPrismaRepository(injection),
    NOOP_REPORT_SECTIONS_TELEMETRY,
    createNullLogger(),
  );
  const leadFormService = new LeadFormService(
    new LeadFormPrismaRepository(injection),
    NOOP_REPORT_SECTIONS_TELEMETRY,
  );
  let data: Awaited<ReturnType<typeof seedTestData>>;
  let privateIdentities: string[];

  function callers(userId = data.lead.id, role: Role = "lead") {
    const context = {
      session: {
        userId,
        email: "actor@test.local",
        name: "Actor",
        role,
        reportingGroupId: data.lead.reportingGroupId ?? undefined,
        viewerGroupAccess: [],
        activeReportId: data.report.id,
        activeReportSectionId: data.section.id,
      },
      logger: createNullLogger(),
      auditLogger: createNullAuditLogger(),
      ip: "test-ip",
      isPdfExport: false,
      pdfReportId: null,
    };
    return {
      reports: createReportsRouter({
        reportSectionsService,
      } as never).createCaller(context),
      form: createLeadFormRouter({ leadFormService } as never).createCaller(
        context,
      ),
    };
  }

  async function storedState() {
    return {
      sections: await prisma.reportSection.findMany({ orderBy: { id: "asc" } }),
      risks: await prisma.risk.findMany({ orderBy: { id: "asc" } }),
      decisions: await prisma.decision.findMany({ orderBy: { id: "asc" } }),
      comments: await prisma.recordComment.findMany({ orderBy: { id: "asc" } }),
    };
  }

  function expectNoPrivateData(value: unknown) {
    const serialized = JSON.stringify(value);
    for (const secret of [
      PRIVATE_RISK,
      PRIVATE_DECISION,
      PRIVATE_COMMENT,
      ...privateIdentities,
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).not.toContain("retainedDrafts");
  }

  async function readOwn(actor = callers()) {
    const history = await actor.reports.myHistory({ limit: 20 });
    const active = await actor.reports.getActive();
    const form = await actor.form.byPeriod({ reportId: data.report.id });
    const overview = await actor.form.statusOverview({
      reportId: data.report.id,
    });
    return { history, active, form, overview };
  }

  function expectCompleteReads(result: Awaited<ReturnType<typeof readOwn>>) {
    expect(result.history.items).toMatchObject([
      { sectionId: data.section.id, riskCount: 1, decisionCount: 1 },
    ]);
    expect(result.active?.risks).toMatchObject([{ risk: "Complete risk" }]);
    expect(result.active?.decisions).toMatchObject([
      { text: "Complete decision" },
    ]);
    expectNoPrivateData(result.active);
    expectNoPrivateData(result.overview);
  }

  function expectOwnDrafts(result: Awaited<ReturnType<typeof readOwn>>) {
    expectCompleteReads(result);
    expect(result.history.items[0]?.retainedDrafts).toEqual({
      risks: 1,
      decisions: 1,
      readOnlyReason: "not-current",
    });
    expect(result.form.section.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ risk: PRIVATE_RISK, impact: null }),
      ]),
    );
    expect(result.form.section.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: PRIVATE_DECISION, impact: null }),
      ]),
    );
  }

  beforeEach(async () => {
    await cleanDatabase();
    data = await seedTestData(prisma);
    await prisma.stage.create({
      data: { id: STAGE_ID, name: "Development", sortOrder: 3 },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: data.lead.id,
        projectId: data.project.id,
        stageId: STAGE_ID,
      },
    });
    // A newer open report makes this source discoverable through retained history.
    await prisma.report.create({
      data: {
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "draft",
      },
    });
    const risk = await prisma.risk.create({
      data: {
        reportSectionId: data.section.id,
        projectId: data.project.id,
        risk: PRIVATE_RISK,
        impact: null,
        mitigation: "Private mitigation",
        severity: "at-risk",
        stageNames: ["Development"],
      },
    });
    const decision = await prisma.decision.create({
      data: {
        reportSectionId: data.section.id,
        productId: data.project.id,
        owner: "Lead",
        text: PRIVATE_DECISION,
        impact: null,
        stageNames: ["Development"],
      },
    });
    const comment = await prisma.recordComment.create({
      data: {
        reviewerId: data.head.id,
        riskId: risk.id,
        text: PRIVATE_COMMENT,
      },
    });
    privateIdentities = [
      risk.id,
      risk.stableId,
      decision.id,
      decision.stableId,
      comment.id,
    ];
    await prisma.risk.create({
      data: {
        reportSectionId: data.section.id,
        projectId: data.project.id,
        risk: "Complete risk",
        impact: "Delay",
        mitigation: "Escalate",
        severity: "at-risk",
        stageNames: ["Development"],
      },
    });
    await prisma.decision.create({
      data: {
        reportSectionId: data.section.id,
        productId: data.project.id,
        owner: "Lead",
        text: "Complete decision",
        impact: "Faster delivery",
        stageNames: ["Development"],
      },
    });
  });

  afterAll(async () => {
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  it("keeps own drafts and complete-only routes without changing stored records", async () => {
    const before = await storedState();
    expectOwnDrafts(await readOwn());
    expect(await storedState()).toEqual(before);
  });

  it.each([
    {
      name: "fresh demotion",
      role: "viewer" as const,
      update: { role: "viewer" as const },
    },
    {
      name: "cached pre-demotion session",
      role: "lead" as const,
      update: { role: "viewer" as const },
    },
    {
      name: "inactive actor",
      role: "lead" as const,
      update: { isActive: false },
    },
  ])(
    "strips private data but preserves complete own reads: $name",
    async ({ role, update }) => {
      const cached = callers();
      expectOwnDrafts(await readOwn(cached));
      await prisma.user.update({ where: { id: data.lead.id }, data: update });
      const before = await storedState();
      const result = await readOwn(
        role === "lead" ? cached : callers(data.lead.id, role),
      );
      expectCompleteReads(result);
      expectNoPrivateData(result);
      expect(result.form.section.risks).toHaveLength(1);
      expect(result.form.section.decisions).toHaveLength(1);
      expect(await storedState()).toEqual(before);
    },
  );

  it.each(["lead", "head", "admin"] as const)(
    "does not treat a foreign cached pointer or %s role as ownership",
    async (role) => {
      await prisma.user.update({ where: { id: data.head.id }, data: { role } });
      const actor = callers(data.head.id, role);
      const before = await storedState();
      await expect(actor.reports.getActive()).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(actor.reports.myHistory({ limit: 20 })).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
      if (role !== "lead") {
        const form = await actor.form.byPeriod({
          reportId: data.report.id,
          authorId: data.lead.id,
        });
        expect(form.section.risks).toHaveLength(1);
        expect(form.section.decisions).toHaveLength(1);
        expect(form.recordOmissions).toMatchObject({
          unknown: false,
          risks: 1,
          decisions: 1,
        });
        expectNoPrivateData(form);
      } else {
        await expect(
          actor.form.byPeriod({ reportId: data.report.id }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
      }
      expect(await storedState()).toEqual(before);
    },
  );

  it("retains own source access after Product stage reassignment", async () => {
    const actor = callers();
    expectOwnDrafts(await readOwn(actor));
    await prisma.stageAssignment.updateMany({
      where: { userId: data.lead.id },
      data: { userId: data.head.id },
    });
    const before = await storedState();
    expectOwnDrafts(await readOwn(actor));
    expect(await storedState()).toEqual(before);
  });
});
