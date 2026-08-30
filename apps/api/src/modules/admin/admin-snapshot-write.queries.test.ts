import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { saveSnapshot } from "./admin-snapshot-write.queries.js";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("saveSnapshot — reporting-group integrity", () => {
  it("rejects a groupless lead before opening a restore transaction", async () => {
    const transaction = vi.fn();
    const prisma = { $transaction: transaction } as unknown as PrismaService;
    const malformedSnapshot = {
      users: [
        {
          id: USER_ID,
          email: "lead@example.test",
          name: "Lead Example",
          lastName: "Lead",
          firstName: "Example",
          middleName: null,
          position: null,
          role: "lead",
          isActive: true,
        },
      ],
      groups: [],
      projects: [],
      periods: [],
      reminderRules: [],
      reminderExecutions: [],
      policies: [],
    };

    await expect(
      saveSnapshot(prisma, undefined, malformedSnapshot as never),
    ).rejects.toThrow(/reportingGroupId/);
    expect(transaction).not.toHaveBeenCalled();
  });
});
