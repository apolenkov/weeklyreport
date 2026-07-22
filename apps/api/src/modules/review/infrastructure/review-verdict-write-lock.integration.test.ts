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
import { ReviewConstraintError } from "../application/review.service.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";

describe("review verdict published-period write lock (integration)", () => {
  const prisma = createTestPrisma();
  const publishedAt = new Date("2026-07-22T12:00:00.000Z");

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
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
      judgedVersion: testData.section.version,
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
