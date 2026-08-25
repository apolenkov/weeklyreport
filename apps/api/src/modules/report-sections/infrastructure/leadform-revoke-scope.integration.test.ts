import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../../test-utils/prisma-test-helper";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository";

// BOLA: group-A scope must not read/write group-B section on the same report.
const GROUP_B = "b0000000-0000-4000-8000-00000000000b";
const LEAD_B = "b0000000-0000-4000-8000-0000000000b1";
const SECTION_B = "b0000000-0000-4000-8000-0000000000b3";

const SCOPE_A = {
  author: { reportingGroupId: { in: [TEST_IDS.group] } },
};

describe("lead-form revoke scope (integration)", () => {
  const prisma = createTestPrisma();
  let repo: LeadFormPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    repo = new LeadFormPrismaRepository(prisma as never);

    // Group-A section (the seeded one) → submitted.
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted" },
    });

    // Co-locate a submitted group-B section on the SAME report.
    await prisma.reportingGroup.create({
      data: { id: GROUP_B, name: "Group B", description: "Other group" },
    });
    await prisma.user.create({
      data: {
        id: LEAD_B,
        email: "lead-b@test.local",
        name: "Lead B",
        lastName: "B",
        firstName: "Lead",
        role: "lead",
        samlId: "lead-b",
        reportingGroupId: GROUP_B,
      },
    });
    await prisma.reportSection.create({
      data: {
        id: SECTION_B,
        reportId: testData.report.id,
        authorId: LEAD_B,
        status: "submitted",
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("getSectionByIdScoped denies an out-of-group section but allows in-group", async () => {
    expect(await repo.getSectionByIdScoped(SECTION_B, SCOPE_A)).toBeNull();
    expect(
      await repo.getSectionByIdScoped(testData.section.id, SCOPE_A),
    ).not.toBeNull();
  });

  it("revokeAllSubmitted with a group-A scope flips only group-A and leaves group-B submitted", async () => {
    const count = await repo.revokeAllSubmitted(
      testData.report.id,
      testData.head.id,
      SCOPE_A,
    );

    expect(count).toBe(1);
    const sectionA = await prisma.reportSection.findUnique({
      where: { id: testData.section.id },
    });
    const sectionB = await prisma.reportSection.findUnique({
      where: { id: SECTION_B },
    });
    expect(expectDefined(sectionA).status).toBe("draft");
    expect(expectDefined(sectionB).status).toBe("submitted");
  });

  it("revokeAllSubmitted with an admin scope ({}) flips every submitted section", async () => {
    const count = await repo.revokeAllSubmitted(
      testData.report.id,
      testData.head.id,
      {},
    );

    expect(count).toBe(2);
    const sectionB = await prisma.reportSection.findUnique({
      where: { id: SECTION_B },
    });
    expect(expectDefined(sectionB).status).toBe("draft");
  });
});
