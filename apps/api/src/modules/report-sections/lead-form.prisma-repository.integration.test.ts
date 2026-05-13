import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
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
});
