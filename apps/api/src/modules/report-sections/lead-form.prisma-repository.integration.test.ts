import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository";

describe("LeadFormPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: LeadFormPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new LeadFormPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("snapshots and restores decision and priority productId", async () => {
    await prisma.decision.create({
      data: {
        reportSectionId: testData.section.id,
        productId: testData.project.id,
        text: "Snapshot decision",
        owner: "Lead",
        impact: "High",
      },
    });
    await prisma.priority.create({
      data: {
        reportSectionId: testData.section.id,
        productId: testData.project.id,
        rank: 1,
        text: "Snapshot priority",
      },
    });

    await repo.createVersionSnapshot(testData.section.id);
    await prisma.decision.deleteMany({
      where: { reportSectionId: testData.section.id },
    });
    await prisma.priority.deleteMany({
      where: { reportSectionId: testData.section.id },
    });

    await repo.restoreVersion(testData.section.id, 1);

    const decision = await prisma.decision.findFirstOrThrow({
      where: { reportSectionId: testData.section.id },
    });
    const priority = await prisma.priority.findFirstOrThrow({
      where: { reportSectionId: testData.section.id },
    });
    expect(decision.productId).toBe(testData.project.id);
    expect(priority.productId).toBe(testData.project.id);
  });

  it("fills from a source section without copying or clearing priorities", async () => {
    const sourceReport = await prisma.report.create({
      data: {
        periodStart: new Date("2026-03-31T00:00:00.000Z"),
        periodEnd: new Date("2026-04-06T00:00:00.000Z"),
        deadline: new Date("2026-04-05T18:00:00.000Z"),
        status: "published",
        periodStatus: "published",
        publishedAt: new Date("2026-04-05T19:00:00.000Z"),
      },
    });
    const sourceSection = await prisma.reportSection.create({
      data: {
        reportId: sourceReport.id,
        authorId: testData.lead.id,
        status: "submitted",
        submittedAt: new Date("2026-04-05T17:00:00.000Z"),
      },
    });

    await prisma.item.createMany({
      data: [
        {
          reportSectionId: sourceSection.id,
          projectId: testData.project.id,
          type: "current",
          text: "Source current item",
          tag: "feature",
          workflowStatus: "in_progress",
          carriedOver: true,
        },
        {
          reportSectionId: sourceSection.id,
          projectId: testData.project.id,
          type: "next",
          text: "Source next item",
          tag: "plan",
          workflowStatus: "in_progress",
          carriedOver: false,
        },
      ],
    });
    await prisma.risk.create({
      data: {
        reportSectionId: sourceSection.id,
        projectId: testData.project.id,
        risk: "Source blocked risk",
        impact: "High impact",
        mitigation: "Mitigate now",
        severity: "blocked",
        stageName: "Dev",
      },
    });
    await prisma.decision.create({
      data: {
        reportSectionId: sourceSection.id,
        productId: testData.project.id,
        text: "Source decision",
        owner: "Lead",
        impact: "High",
        stageName: "Testing",
      },
    });
    await prisma.priority.create({
      data: {
        reportSectionId: sourceSection.id,
        productId: testData.project.id,
        rank: 2,
        text: "Source priority must not copy",
      },
    });

    await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: "current",
        text: "Target stale item",
        tag: "stale",
        workflowStatus: "blocked",
      },
    });
    await prisma.risk.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        risk: "Target stale risk",
        impact: "Old",
        mitigation: "Old",
      },
    });
    await prisma.decision.create({
      data: {
        reportSectionId: testData.section.id,
        productId: testData.project.id,
        text: "Target stale decision",
        owner: "Lead",
        impact: "Old",
      },
    });
    await prisma.priority.create({
      data: {
        reportSectionId: testData.section.id,
        productId: testData.project.id,
        rank: 1,
        text: "Target fresh priority",
      },
    });

    const copiedCount = await repo.fillFromSection(
      testData.section.id,
      sourceSection.id,
    );

    const [items, risks, decisions, priorities] = await Promise.all([
      prisma.item.findMany({
        where: { reportSectionId: testData.section.id },
        orderBy: { text: "asc" },
      }),
      prisma.risk.findMany({ where: { reportSectionId: testData.section.id } }),
      prisma.decision.findMany({
        where: { reportSectionId: testData.section.id },
      }),
      prisma.priority.findMany({
        where: { reportSectionId: testData.section.id },
      }),
    ]);

    expect(copiedCount).toBe(4);
    expect(items.map((item) => item.text)).toEqual([
      "Source current item",
      "Source next item",
    ]);
    expect(items.every((item) => item.type === "current")).toBe(true);
    expect(items.every((item) => item.carriedOver === false)).toBe(true);
    expect(risks).toHaveLength(1);
    expect(expectDefined(risks[0]).severity).toBe("blocked");
    expect(expectDefined(risks[0]).stageName).toBe("Dev");
    expect(decisions).toHaveLength(1);
    expect(expectDefined(decisions[0]).text).toBe("Source decision");
    expect(priorities).toHaveLength(1);
    expect(expectDefined(priorities[0]).text).toBe("Target fresh priority");
  });
});
