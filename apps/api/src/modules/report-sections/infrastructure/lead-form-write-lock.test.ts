import { describe, expect, it, vi } from "vitest";

import { LeadFormConstraintError } from "../domain/lead-form-shared.js";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository.js";

describe("LeadFormPrismaRepository.fillFromSection write lock", () => {
  it("rejects a published target before the version CAS", async () => {
    const updateMany = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ periodStatus: "published" }]),
      reportSection: { updateMany },
    };
    const prisma = {
      reportSection: {
        findUnique: vi.fn().mockResolvedValue({
          items: [],
          risks: [],
          decisions: [],
        }),
      },
      activityStatus: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const repo = new LeadFormPrismaRepository(prisma as never);

    await expect(
      repo.fillFromSection(
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        1,
      ),
    ).rejects.toBeInstanceOf(LeadFormConstraintError);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
