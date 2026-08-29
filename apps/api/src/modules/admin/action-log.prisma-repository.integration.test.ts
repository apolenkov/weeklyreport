import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper.js";
import { ActionLogPrismaRepository } from "./action-log.prisma-repository.js";

const SHARED_TIME = new Date("2026-07-22T12:00:00.000Z");
const OLDER_TIME = new Date("2026-07-21T12:00:00.000Z");
const IDS = [
  "f0000000-0000-4000-8000-000000000005",
  "f0000000-0000-4000-8000-000000000004",
  "f0000000-0000-4000-8000-000000000003",
  "f0000000-0000-4000-8000-000000000002",
  "f0000000-0000-4000-8000-000000000001",
] as const;

describe("ActionLogPrismaRepository composite keyset (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new ActionLogPrismaRepository(prisma as never);

  beforeEach(async () => {
    await cleanDatabase();
    // Inserted in ascending-id order so the heap order opposes the expected
    // DESC traversal: without the id tiebreaker, equal-createdAt rows come
    // back in insertion order and the assertion below fails.
    await prisma.userActionLog.createMany({
      data: IDS.map((id, index) => ({
        id,
        userId: "admin-user",
        role: "admin" as const,
        procedure: "admin.test",
        status: "success" as const,
        correlationId: `correlation-${String(index)}`,
        durationMs: index,
        createdAt: index < 3 ? SHARED_TIME : OLDER_TIME,
      })).toReversed(),
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("traverses equal timestamps in stable order without gaps or duplicates", async () => {
    const first = await repository.listActionLog({ limit: 2 });
    const firstCursor = first.at(-1)?.id;
    if (firstCursor === undefined) {
      throw new Error("The first page did not provide a pagination cursor");
    }
    const second = await repository.listActionLog({
      limit: 2,
      cursor: firstCursor,
    });
    const secondCursor = second.at(-1)?.id;
    if (secondCursor === undefined) {
      throw new Error("The second page did not provide a pagination cursor");
    }
    const third = await repository.listActionLog({
      limit: 2,
      cursor: secondCursor,
    });
    const traversed = [...first, ...second, ...third].map((row) => row.id);

    expect(traversed).toEqual(IDS);
    expect(new Set(traversed).size).toBe(IDS.length);
  });
});
