import type { Role } from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { createLeadFormRouter } from "../../../infrastructure/trpc/routers/lead-form.router.js";
import { createNullLogger } from "../../../lib/logger.js";
import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
} from "../../../test-utils/prisma-test-helper";
import { RetainedIncompleteRecordsService } from "../application/retained-incomplete-records.service.js";
import { RetainedSourcePrismaReader } from "./retained-incomplete-records.query.js";

const STAGE_ID = "a0000000-0000-4000-a000-000000000aa1";
const RISK_STABLE_ID = "b0000000-0000-4000-a000-000000000bb1";
const OTHER_REPORT_ID = "c0000000-0000-4000-a000-000000000cc1";
const STAGES = ["Development"];
const UNAVAILABLE = { status: "unavailable" };

describe("leadForm.retainedIncompleteRecords (integration)", () => {
  const prisma = createTestPrisma();
  const service = new RetainedIncompleteRecordsService(
    // The integration client crosses the reader's PrismaService injection
    // boundary through this test-only cast.
    new RetainedSourcePrismaReader(prisma as unknown as PrismaService),
  );
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  // The session role is what the caller's cookie still says; the database
  // row is what the read must believe.
  function readAs(
    userId: string,
    role: Role = "lead",
    reportId: string = testData.report.id,
  ) {
    return createLeadFormRouter({
      retainedIncompleteRecordsService: service,
    } as never)
      .createCaller({
        session: {
          userId,
          email: "actor@test.local",
          name: "Actor",
          role,
          viewerGroupAccess: [],
          activeReportId: null,
          activeReportSectionId: testData.section.id,
        },
        logger: createNullLogger(),
        auditLogger: createNullAuditLogger(),
        ip: "test-ip",
        isPdfExport: false,
        pdfReportId: null,
      })
      .retainedIncompleteRecords({
        reportId,
        reportSectionId: testData.section.id,
      });
  }

  async function publishSource() {
    const publishedAt = new Date("2026-04-12T10:00:00.000Z");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt,
        publishedSnapshot: publishedSnapshotFixture({
          reportId: testData.report.id,
          periodStart: testData.report.periodStart,
          periodEnd: testData.report.periodEnd,
          publishedAt,
        }),
      },
    });
  }

  // Everything a read-only recovery must leave exactly as it found it.
  async function storedState() {
    return {
      sections: await prisma.reportSection.findMany({
        orderBy: { id: "asc" },
        select: { id: true, version: true, updatedAt: true },
      }),
      risks: await prisma.risk.findMany({
        select: { id: true, stableId: true, impact: true, updatedAt: true },
      }),
      comments: await prisma.recordComment.count(),
    };
  }

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    await prisma.stage.create({
      data: { id: STAGE_ID, name: "Development", sortOrder: 3 },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        stageId: STAGE_ID,
        projectId: testData.project.id,
      },
    });
    const risk = await prisma.risk.create({
      data: {
        stableId: RISK_STABLE_ID,
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        risk: "Vendor may slip",
        impact: null,
        mitigation: null,
        severity: "at-risk",
        stageNames: STAGES,
      },
    });
    await prisma.recordComment.create({
      data: {
        reviewerId: testData.head.id,
        riskId: risk.id,
        text: "Reviewer note",
      },
    });
    await publishSource();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("returns the author's retained draft of a published source, read-only", async () => {
    const before = await storedState();

    const result = await readAs(testData.lead.id);

    expect(result).toMatchObject({
      status: "available",
      reportId: testData.report.id,
      reportSectionId: testData.section.id,
      periodStart: testData.report.periodStart,
      periodEnd: testData.report.periodEnd,
      readOnlyReason: "published",
      risks: [{ stableId: RISK_STABLE_ID, risk: "Vendor may slip" }],
      decisions: [],
    });
    expect(JSON.stringify(result)).not.toContain("Reviewer note");
    expect(await storedState()).toEqual(before);
  });

  it("explains an archived source and leaves it archived", async () => {
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { archived: true, periodState: "archived" },
    });

    await expect(readAs(testData.lead.id)).resolves.toMatchObject({
      status: "available",
      readOnlyReason: "archived",
    });
  });

  it("denies an author demoted in the database while the session still says lead", async () => {
    await prisma.user.update({
      where: { id: testData.lead.id },
      data: { role: "viewer" },
    });

    await expect(readAs(testData.lead.id, "lead")).resolves.toEqual(
      UNAVAILABLE,
    );
  });

  it("denies a deactivated author", async () => {
    await prisma.user.update({
      where: { id: testData.lead.id },
      data: { isActive: false },
    });

    await expect(readAs(testData.lead.id)).resolves.toEqual(UNAVAILABLE);
  });

  it("gives another author nothing, whatever their real role", async () => {
    // The head is a real authoring-role user but not this section's author;
    // the session role is forged to lead so only ownership can deny.
    await expect(readAs(testData.head.id, "lead")).resolves.toEqual(
      UNAVAILABLE,
    );
    await expect(readAs(testData.head.id, "head")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("keeps the draft readable after the author lost the Product stage", async () => {
    await prisma.stageAssignment.deleteMany({
      where: { userId: testData.lead.id },
    });

    await expect(readAs(testData.lead.id)).resolves.toMatchObject({
      status: "available",
      risks: [{ stableId: RISK_STABLE_ID }],
    });
  });

  it("does not provision a section for a report the author has none in", async () => {
    await prisma.report.create({
      data: {
        id: OTHER_REPORT_ID,
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "draft",
      },
    });
    const before = await storedState();

    await expect(
      readAs(testData.lead.id, "lead", OTHER_REPORT_ID),
    ).resolves.toEqual(UNAVAILABLE);

    expect(await storedState()).toEqual(before);
  });

  it("is unavailable once the author completed the record", async () => {
    await prisma.risk.updateMany({
      where: { stableId: RISK_STABLE_ID },
      data: { impact: "Delivery slips", mitigation: "Escalate" },
    });

    await expect(readAs(testData.lead.id)).resolves.toEqual(UNAVAILABLE);
  });
});
