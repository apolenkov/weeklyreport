import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";

/**
 * reopen-request-lifecycle (D5): the one-pending-per-section rule is enforced by
 * a PARTIAL unique index `ReopenRequest_one_pending_per_section`
 * ON ("reportSectionId") WHERE "status" = 'pending', hand-written in the init
 * migration because Prisma cannot express the predicate. These integration
 * tests prove the index exists and actually bites — the application-level check
 * gives the friendly error, but this index is the durable guarantee against a
 * race between two requestReopen calls.
 */

describe("ReopenRequest one-pending partial index (integration)", () => {
  const prisma = createTestPrisma();
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted", submittedAt: new Date() },
    });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("the partial unique index is present in the schema", async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'ReopenRequest'
        AND indexname = 'ReopenRequest_one_pending_per_section'`;
    expect(rows).toHaveLength(1);
  });

  it("rejects a second pending request for the same section", async () => {
    await prisma.reopenRequest.create({
      data: {
        reportSectionId: testData.section.id,
        requestedById: testData.lead.id,
      },
    });

    await expect(
      prisma.reopenRequest.create({
        data: {
          reportSectionId: testData.section.id,
          requestedById: testData.lead.id,
        },
      }),
    ).rejects.toThrow();

    const count = await prisma.reopenRequest.count({
      where: { reportSectionId: testData.section.id, status: "pending" },
    });
    expect(count).toBe(1);
  });

  it("allows a new pending request once the prior one is decided", async () => {
    const first = await prisma.reopenRequest.create({
      data: {
        reportSectionId: testData.section.id,
        requestedById: testData.lead.id,
      },
    });
    await prisma.reopenRequest.update({
      where: { id: first.id },
      data: { status: "rejected" },
    });

    await expect(
      prisma.reopenRequest.create({
        data: {
          reportSectionId: testData.section.id,
          requestedById: testData.lead.id,
        },
      }),
    ).resolves.toMatchObject({ status: "pending" });
  });
});
