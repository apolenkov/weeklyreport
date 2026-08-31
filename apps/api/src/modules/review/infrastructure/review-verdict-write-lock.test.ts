import { describe, expect, it, vi } from "vitest";

import { ReviewConstraintError } from "../application/review.service.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";

describe("ReviewActionsPrismaRepository.postVerdict write lock", () => {
  it("rejects a published period before the section CAS and verdict upsert", async () => {
    const updateMany = vi.fn();
    const upsert = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: "55555555-5555-4555-8555-555555555555",
          status: "published",
          periodState: "published",
          periodStatus: "published",
          archived: false,
          autoPublished: false,
          autoArchived: false,
          publishedAt: new Date("2026-07-22T12:00:00.000Z"),
          publishedById: "55555555-5555-4555-8555-555555555555",
          reopenedAt: null,
        },
      ]),
      user: {
        findUnique: vi.fn().mockResolvedValue({
          role: "admin",
          reportingGroupId: null,
          viewerGroupAccess: [],
        }),
      },
      reportSection: {
        findUnique: vi.fn().mockResolvedValue({
          reportId: "55555555-5555-4555-8555-555555555555",
          authorId: "66666666-6666-4666-8666-666666666666",
          status: "submitted",
          author: { reportingGroupId: "77777777-7777-4777-8777-777777777777" },
        }),
        updateMany,
      },
      sectionReview: { upsert },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const repo = new ReviewActionsPrismaRepository(prisma as never);

    await expect(
      repo.postVerdict({
        sectionId: "44444444-4444-4444-8444-444444444444",
        reviewerId: "55555555-5555-4555-8555-555555555555",
        verdict: "changes_requested",
        expectedVersion: 1,
        currentStatus: "submitted",
      }),
    ).rejects.toBeInstanceOf(ReviewConstraintError);
    expect(tx.$queryRaw.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(updateMany).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
