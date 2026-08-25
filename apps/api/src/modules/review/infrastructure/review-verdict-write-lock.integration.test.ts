import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createPauseGate,
  pauseBeforeTransaction,
} from "../../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import {
  ReviewConstraintError,
  ReviewNotFoundError,
} from "../application/review.service.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";

describe("review verdict published-period write lock (integration)", () => {
  const prisma = createTestPrisma();
  const publishedAt = new Date("2026-07-22T12:00:00.000Z");

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("rejects a verdict on an archived report even while periodStatus stays open", async () => {
    // The archive transition does not touch periodStatus, so the in-tx gate
    // must check `archived` itself.
    const testData = await seedTestData(prisma);
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: {
        status: "submitted",
        submittedAt: new Date("2026-07-22T11:00:00.000Z"),
      },
    });
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { archived: true },
    });
    const repo = new ReviewActionsPrismaRepository(prisma as never);

    await expect(
      repo.postVerdict({
        sectionId: testData.section.id,
        reviewerId: testData.head.id,
        verdict: "changes_requested",
        expectedVersion: testData.section.version,
        currentStatus: "submitted",
      }),
    ).rejects.toBeInstanceOf(ReviewConstraintError);
    await expect(
      prisma.sectionReview.count({
        where: { reportSectionId: testData.section.id },
      }),
    ).resolves.toBe(0);
  });

  it("reports NOT_FOUND, not a period constraint, for a section deleted mid-flight", async () => {
    const testData = await seedTestData(prisma);
    const sectionId = testData.section.id;
    const version = testData.section.version;
    await prisma.reportSection.delete({ where: { id: sectionId } });
    const repo = new ReviewActionsPrismaRepository(prisma as never);

    await expect(
      repo.postVerdict({
        sectionId,
        reviewerId: testData.head.id,
        verdict: "changes_requested",
        expectedVersion: version,
        currentStatus: "submitted",
      }),
    ).rejects.toBeInstanceOf(ReviewNotFoundError);
  });

  it("writes no verdict or revoke when publish commits before the transaction", async () => {
    const testData = await seedTestData(prisma);
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: {
        status: "submitted",
        submittedAt: new Date("2026-07-22T11:00:00.000Z"),
      },
    });
    const gate = createPauseGate();
    const repo = new ReviewActionsPrismaRepository(
      pauseBeforeTransaction(prisma, gate.pause) as never,
    );
    const verdict = repo.postVerdict({
      sectionId: testData.section.id,
      reviewerId: testData.head.id,
      verdict: "changes_requested",
      expectedVersion: testData.section.version,
      currentStatus: "submitted",
    });

    await gate.paused;
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt,
      },
    });
    gate.release();

    await expect(verdict).rejects.toBeInstanceOf(ReviewConstraintError);
    await expect(
      prisma.sectionReview.count({
        where: { reportSectionId: testData.section.id },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.reportSection.findUniqueOrThrow({
        where: { id: testData.section.id },
        select: {
          status: true,
          submittedAt: true,
          revokedAt: true,
          revokedBy: true,
        },
      }),
    ).resolves.toEqual({
      status: "submitted",
      submittedAt: new Date("2026-07-22T11:00:00.000Z"),
      revokedAt: null,
      revokedBy: null,
    });
  });
});
