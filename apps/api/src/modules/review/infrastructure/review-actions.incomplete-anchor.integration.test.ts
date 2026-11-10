// Reviewer comments on an unfinished risk, decided from the stored record
// under the real User → Report locks (openspec: lead-incomplete-record-drafts,
// task 3R.1). The mocked-transaction counterpart is
// `review-actions.incomplete-anchor.test.ts`.
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import { ReviewNotFoundError } from "../application/review.service.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";

describe("review comments on an unfinished risk (PostgreSQL integration)", () => {
  const prisma = createTestPrisma();
  const repo = new ReviewActionsPrismaRepository(
    prisma as unknown as PrismaService,
  );
  let data: Awaited<ReturnType<typeof seedTestData>>;
  let riskId = "";

  const head = () => ({
    userId: data.head.id,
    role: "head" as const,
    reportingGroupId: data.head.reportingGroupId ?? undefined,
  });
  const comments = () =>
    prisma.recordComment.findMany({
      select: { id: true, reviewerId: true, riskId: true, createdAt: true },
    });
  const setDetails = (impact: string | null, mitigation: string | null) =>
    prisma.risk.update({ where: { id: riskId }, data: { impact, mitigation } });

  beforeEach(async () => {
    await cleanDatabase();
    data = await seedTestData(prisma);
    const risk = await prisma.risk.create({
      data: {
        reportSectionId: data.section.id,
        projectId: data.project.id,
        risk: "Vendor may slip",
        impact: null,
        mitigation: null,
        severity: "at-risk",
        stageNames: ["Development"],
      },
    });
    riskId = risk.id;
  });

  afterAll(async () => {
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  it("refuses a Head's comment while the risk is unfinished and accepts it once finished", async () => {
    await expect(
      repo.insertComment(head(), { riskId }, "What is the impact?"),
    ).rejects.toMatchObject({
      constructor: ReviewNotFoundError,
      message: "Record not found.",
    });
    expect(await comments()).toEqual([]);

    await setDetails("Date slips", "Second vendor");

    const created = await repo.insertComment(head(), { riskId }, "Noted");
    expect(await comments()).toMatchObject([
      { id: created.id, reviewerId: data.head.id, riskId },
    ]);
  });

  it("keeps a reviewer's comment while the risk is unfinished again, unchanged", async () => {
    await setDetails("Date slips", "Second vendor");
    const created = await repo.insertComment(head(), { riskId }, "Noted");
    const before = await comments();

    // The author clears a detail: the risk is their private draft again.
    await setDetails(null, "Second vendor");
    await expect(repo.deleteComment(created.id, head())).rejects.toMatchObject({
      constructor: ReviewNotFoundError,
      message: "Comment not found.",
    });
    expect(await comments()).toEqual(before);

    // Finished again: the same comment, and its writer may delete it.
    await setDetails("Date slips", "Second vendor");
    await expect(
      repo.deleteComment(created.id, head()),
    ).resolves.toBeUndefined();
    expect(await comments()).toEqual([]);
  });
});
