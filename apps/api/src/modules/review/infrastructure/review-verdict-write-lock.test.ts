import { describe, expect, it, vi } from "vitest";

import { ReviewConstraintError } from "../application/review.service.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";

describe("ReviewActionsPrismaRepository.postVerdict write lock", () => {
  it("rejects a published period before the section CAS and verdict upsert", async () => {
    const updateMany = vi.fn();
    const upsert = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ periodStatus: "published" }]),
      reportSection: { updateMany },
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
        judgedVersion: 1,
        expectedVersion: 1,
        currentStatus: "submitted",
      }),
    ).rejects.toBeInstanceOf(ReviewConstraintError);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(updateMany).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
