import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  collectScopedSeedCounts,
  SEED_PROFILE_SCOPES,
} from "./seed-profile-scope.js";

describe("seed profile count scope", () => {
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
