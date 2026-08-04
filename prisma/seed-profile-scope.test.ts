import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  assertCanonicalProduct,
  collectScopedSeedCounts,
  SEED_PROFILE_SCOPES,
} from "./seed-profile-scope.js";

describe("seed profile product scope integrity", () => {
  it("rejects a canonical product id absent from the catalogue", () => {
    expect(() =>
      assertCanonicalProduct("a0000000-0000-4000-8000-00000000ffff"),
    ).toThrow(/missing from SEED_PRODUCTS/);
  });

  it("addresses every demo product by stable named id present in the catalogue", () => {
    const scope = SEED_PROFILE_SCOPES.demo;
    expect(scope.projectIds.length).toBeGreaterThanOrEqual(9);
    expect(scope.projectIds).toContain("a0000000-0000-4000-8000-000000000201");
    expect(scope.projectIds).toContain("a0000000-0000-4000-8000-00000000020b");
  });

  it("counts only profile-owned IDs and reports", async () => {
    const count = vi.fn().mockResolvedValue(1);
    const prisma = {
      user: { count },
      project: { count },
      report: { count },
      reportSection: { count },
      item: { count },
    } as unknown as PrismaClient;

    await collectScopedSeedCounts(prisma, "minimal");

    const scope = SEED_PROFILE_SCOPES.minimal;
    expect(count).toHaveBeenCalledWith({
      where: { id: { in: [...scope.userIds] } },
    });
    expect(count).toHaveBeenCalledWith({
      where: { id: { in: [...scope.projectIds] } },
    });
    expect(count).toHaveBeenCalledWith({
      where: { id: { in: [...scope.reportIds] } },
    });
    expect(count).toHaveBeenCalledWith({
      where: { reportId: { in: [...scope.reportIds] } },
    });
    expect(count).toHaveBeenCalledWith({
      where: {
        reportSection: { reportId: { in: [...scope.reportIds] } },
      },
    });
  });
});
