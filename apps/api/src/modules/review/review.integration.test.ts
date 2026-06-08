import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { ReviewPrismaRepository } from "./review.prisma-repository";

describe("ReviewPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: ReviewPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new ReviewPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("getSubmissionDashboard returns rows for all sections in report", async () => {
    const rows = await repo.getSubmissionDashboard(testData.report.id, {
      role: "admin",
    });

    expect(rows).toHaveLength(1);
    expect(expectDefined(rows[0]).leadId).toBe(testData.lead.id);
    expect(expectDefined(rows[0]).leadName).toBe("Test Lead 1");
    expect(expectDefined(rows[0]).status).toBe("draft");
    expect(expectDefined(rows[0]).projectNames).toContain("Test Project 1");
  });

  it("getSubmissionDashboard returns empty array for non-existent report", async () => {
    const rows = await repo.getSubmissionDashboard(
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
      { role: "admin" },
    );
    expect(rows).toHaveLength(0);
  });

  it("GROUP-T3 / head sees only own-group sections", async () => {
    // Create a second group and a lead in it; the head belongs to the first group.
    const groupB = await prisma.reportingGroup.create({
      data: {
        id: "b0000000-0000-4000-b000-000000000009",
        name: "Group B",
        description: "Second test group",
      },
    });
    const leadB = await prisma.user.create({
      data: {
        id: "b0000000-0000-4000-b000-000000000001",
        email: "lead-b@test.local",
        name: "Lead B",
        role: "lead",
        samlId: "lead-b-test",
        reportingGroupId: groupB.id,
      },
    });
    await prisma.reportSection.create({
      data: {
        reportId: testData.report.id,
        authorId: leadB.id,
        status: "draft",
      },
    });

    // Head of group A should see only the section for the lead in group A.
    const headSession = {
      role: "head" as const,
      reportingGroupId: testData.head.reportingGroupId ?? undefined,
    };
    const rows = await repo.getSubmissionDashboard(
      testData.report.id,
      headSession,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.leadId).toBe(testData.lead.id);
  });

  it("GROUP-T3 / admin sees all sections across groups", async () => {
    const groupB = await prisma.reportingGroup.create({
      data: {
        id: "b0000000-0000-4000-b000-00000000000a",
        name: "Group B (admin test)",
        description: "Second test group for admin scope",
      },
    });
    const leadB = await prisma.user.create({
      data: {
        id: "b0000000-0000-4000-b000-000000000002",
        email: "lead-b2@test.local",
        name: "Lead B2",
        role: "lead",
        samlId: "lead-b2-test",
        reportingGroupId: groupB.id,
      },
    });
    await prisma.reportSection.create({
      data: {
        reportId: testData.report.id,
        authorId: leadB.id,
        status: "draft",
      },
    });

    const rows = await repo.getSubmissionDashboard(testData.report.id, {
      role: "admin",
    });
    expect(rows).toHaveLength(2);
    const ids = rows.map((r) => r.leadId).sort();
    expect(ids).toContain(testData.lead.id);
    expect(ids).toContain(leadB.id);
  });
});
