import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import { createPauseGate } from "../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import { AdminSnapshotConflictError } from "./admin-shared.js";

// C0707/C0724: a targeted group save is not a status-graph writer, so it can
// create a group id between the restore's existence read and its insert.
describe("admin snapshot restore vs targeted group save (integration)", () => {
  const prisma = createTestPrisma();
  const repo = new AdminPrismaRepository(prisma as never);

  beforeEach(async () => {
    await cleanDatabase();
    await seedTestData(prisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("rolls the whole restore back with a typed conflict when a targeted save creates its new group first", async () => {
    const snapshot = await repo.getSnapshot();
    const existing = expectDefined(snapshot.groups[0], "seeded group");
    const groupId = randomUUID();
    const restored = {
      ...snapshot,
      // The rename is written before the colliding insert, so it shows
      // whether the restore rolled back as a whole.
      groups: [
        { ...existing, name: `${existing.name} restored` },
        ...snapshot.groups.slice(1),
        {
          id: groupId,
          name: "Restored group",
          description: null,
          archived: false,
          headUserId: null,
        },
      ],
    };
    const gate = createPauseGate();
    let held = false;
    // Test-side barrier: hold the restore right after it reads which group
    // ids exist, before it writes any group.
    const pausedPrisma = prisma.$extends({
      query: {
        reportingGroup: {
          async findMany({ args, query }) {
            const rows = await query(args);
            if (!held) {
              held = true;
              await gate.pause();
            }
            return rows;
          },
        },
      },
    });
    const outcome = new AdminPrismaRepository(pausedPrisma as never)
      .saveSnapshot(restored)
      .then(
        () => null,
        (error: unknown) => error,
      );
    await gate.paused;
    try {
      await repo.saveReportingGroup({
        id: groupId,
        name: "Targeted group",
        description: null,
        archived: false,
        headUserId: null,
      });
    } finally {
      gate.release();
    }

    expect(await outcome).toBeInstanceOf(AdminSnapshotConflictError);
    await expect(
      prisma.reportingGroup.findUniqueOrThrow({ where: { id: groupId } }),
    ).resolves.toMatchObject({ name: "Targeted group" });
    await expect(
      prisma.reportingGroup.findUniqueOrThrow({ where: { id: existing.id } }),
    ).resolves.toMatchObject({ name: existing.name });
  });
});
