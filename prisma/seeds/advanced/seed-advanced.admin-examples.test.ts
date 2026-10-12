import type { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { HEAD_USER_ID, SEED_REPORTS } from "../support/seed-constants.js";
import { seedAdminExamples } from "./seed-advanced.admin-examples.js";

describe("advanced Admin examples", () => {
  it("identifies the successful publication fixture with the real period operation on create and reseed", async () => {
    const upsert = vi
      .fn<(args: Prisma.UserActionLogUpsertArgs) => Promise<void>>()
      .mockResolvedValue(undefined);
    const prisma = {
      reopenRequest: { upsert: vi.fn().mockResolvedValue(undefined) },
      userActionLog: { upsert },
    } as unknown as PrismaClient;

    await seedAdminExamples(prisma);

    expect(upsert).toHaveBeenCalledTimes(1);
    const args = upsert.mock.calls[0]?.[0];
    expect(args).toBeDefined();
    for (const row of [args?.create, args?.update]) {
      expect(row).toMatchObject({
        userId: HEAD_USER_ID,
        targetId: SEED_REPORTS.published.id,
        status: "success",
        procedure: "period.publish",
      });
    }
  });
});
