import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import { AdminReportingGroupNotFoundError } from "./admin-errors";

const GROUP_A = "a0000000-0000-4000-a000-000000004329";
const GROUP_B = "b0000000-0000-4000-a000-000000004329";
const MISSING_GROUP = "c0000000-0000-4000-a000-000000004329";
const LOCK_WAIT_TIMEOUT_MS = 5000;
const LOCK_WAIT_POLL_MS = 25;

const groupInput = (id: string, archived: boolean) => ({
  id,
  name: id === GROUP_A ? "Group A" : "Group B",
  description: null,
  headUserId: null,
  archived,
});

describe("last active reporting group (integration)", () => {
  const prisma = createTestPrisma();
  const repo = new AdminPrismaRepository(prisma as never);

  beforeEach(async () => {
    await cleanDatabase();
    await prisma.reportingGroup.create({ data: groupInput(GROUP_A, false) });
  });

  afterAll(async () => {
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  const archive = (id: string, method: "archive" | "save") =>
    method === "archive"
      ? repo.archiveReportingGroup(id)
      : repo.saveReportingGroup(groupInput(id, true));

  it.each(["archive", "save"] as const)(
    "%s refuses to archive the last active group without changing it",
    async (method) => {
      await expect(archive(GROUP_A, method)).rejects.toMatchObject({
        name: "AdminLastActiveGroupError",
      });
      const row = await prisma.reportingGroup.findUniqueOrThrow({
        where: { id: GROUP_A },
      });
      expect(row.archived).toBe(false);
      expect(row.name).toBe("Group A");
    },
  );

  it.each(["archive", "save"] as const)(
    "%s succeeds when another active group remains",
    async (method) => {
      await prisma.reportingGroup.create({ data: groupInput(GROUP_B, false) });
      await expect(archive(GROUP_A, method)).resolves.toMatchObject({
        id: GROUP_A,
        archived: true,
      });
      expect(
        await prisma.reportingGroup.count({ where: { archived: false } }),
      ).toBe(1);
    },
  );

  it("retains head-validation precedence before last-active conflict", async () => {
    await expect(
      repo.saveReportingGroup({
        ...groupInput(GROUP_A, true),
        headUserId: MISSING_GROUP,
      }),
    ).rejects.toMatchObject({
      name: "AdminUserActivityAssignmentConflictError",
    });
    const row = await prisma.reportingGroup.findUniqueOrThrow({
      where: { id: GROUP_A },
    });
    expect(row.archived).toBe(false);
    expect(row.headUserId).toBeNull();
  });

  it("keeps missing archive NOT_FOUND and already-archived archive idempotent", async () => {
    await expect(
      repo.archiveReportingGroup(MISSING_GROUP),
    ).rejects.toBeInstanceOf(AdminReportingGroupNotFoundError);
    await prisma.reportingGroup.create({ data: groupInput(GROUP_B, true) });
    await expect(repo.archiveReportingGroup(GROUP_B)).resolves.toMatchObject({
      id: GROUP_B,
      archived: true,
    });
    expect(
      await prisma.reportingGroup.count({ where: { archived: false } }),
    ).toBe(1);
  });

  it("keeps last-active rename, restore and new archived-group creation available", async () => {
    await expect(
      repo.saveReportingGroup({
        ...groupInput(GROUP_A, false),
        name: "Renamed",
      }),
    ).resolves.toMatchObject({ name: "Renamed", archived: false });
    await expect(
      repo.saveReportingGroup(groupInput(GROUP_B, true)),
    ).resolves.toMatchObject({
      id: GROUP_B,
      archived: true,
    });
    await expect(
      repo.saveReportingGroup(groupInput(GROUP_B, false)),
    ).resolves.toMatchObject({
      id: GROUP_B,
      archived: false,
    });
    expect(
      await prisma.reportingGroup.count({ where: { archived: false } }),
    ).toBe(2);
  });

  // The suite owns its exact guard-approved target exclusively and runs with
  // fileParallelism=false. Both real writers must be waiting behind the held
  // fixture rows; no fixed delay or mock supplies the ordering receipt.
  async function waitForBothGroupWriters(): Promise<void> {
    const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const waiting = await prisma.$queryRaw<{ pid: number }[]>`
        SELECT pid FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND wait_event_type = 'Lock'
          AND query LIKE '%"ReportingGroup"%'
      `;
      if (waiting.length >= 2) {
        console.info(
          "C4329 PostgreSQL writers waiting",
          waiting.map(({ pid }) => pid),
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_POLL_MS));
    }
    throw new Error(
      "Both reporting-group writers did not reach the held database locks",
    );
  }

  it.each([
    ["archive", "archive"],
    ["save", "save"],
    ["archive", "save"],
  ] as const)(
    "serializes concurrent %s/%s attempts on the last two groups",
    async (firstMethod, secondMethod) => {
      await prisma.reportingGroup.create({ data: groupInput(GROUP_B, false) });
      const locked = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const holder = prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
          await tx.$queryRaw`
            SELECT "id" FROM "ReportingGroup"
            WHERE "id" IN (${GROUP_A}, ${GROUP_B}) ORDER BY "id" FOR UPDATE
          `;
          locked.resolve();
          await release.promise;
        },
        { timeout: 15_000 },
      );
      try {
        await Promise.race([locked.promise, holder]);
      } catch (error) {
        release.resolve();
        await Promise.allSettled([holder]);
        throw error;
      }
      const writes = Promise.allSettled([
        archive(GROUP_A, firstMethod),
        archive(GROUP_B, secondMethod),
      ]);
      try {
        await waitForBothGroupWriters();
      } finally {
        release.resolve();
        await Promise.allSettled([holder, writes]);
      }
      await holder;
      const results = await writes;
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.filter((r) => r.status === "rejected");
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toMatchObject({
        name: "AdminLastActiveGroupError",
      });
      expect(
        await prisma.reportingGroup.count({ where: { archived: false } }),
      ).toBe(1);
    },
    20_000,
  );
});
