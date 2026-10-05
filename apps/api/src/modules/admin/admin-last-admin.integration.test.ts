import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import { AdminLastAdminError, AdminSelfLockoutError } from "./admin-errors";
import { upsertUsers } from "./admin-snapshot/users";
import { SnapshotAdminService } from "./snapshot-admin.service";

const ADMIN_A = "a0000000-0000-4000-a000-0000000000a1";
const ADMIN_B = "a0000000-0000-4000-a000-0000000000a2";

describe("last active administrator guard (integration)", () => {
  const prisma = createTestPrisma();
  const repo = new AdminPrismaRepository(prisma as never);
  const service = new SnapshotAdminService(repo, {
    info: () => undefined,
  } as never);
  let groupId: string;

  const makeAdmin = (id: string, suffix: string) =>
    prisma.user.create({
      data: {
        id,
        email: `admin-${suffix}@test.local`,
        name: `Admin ${suffix}`,
        lastName: "Admin",
        firstName: suffix,
        role: "admin",
        samlId: `admin-${suffix}`,
        reportingGroupId: groupId,
      },
    });

  beforeEach(async () => {
    await cleanDatabase();
    const seeded = await seedTestData(prisma);
    groupId = seeded.lead.reportingGroupId ?? "";
    await makeAdmin(ADMIN_A, "a");
  });

  afterAll(async () => {
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  it("rejects self-deactivation and self-delete before touching the row", async () => {
    await makeAdmin(ADMIN_B, "b");
    await expect(service.deactivateUser(ADMIN_A, ADMIN_A)).rejects.toThrow(
      AdminSelfLockoutError,
    );
    await expect(service.removeUser(ADMIN_A, ADMIN_A)).rejects.toThrow(
      AdminSelfLockoutError,
    );
    const row = await prisma.user.findUniqueOrThrow({ where: { id: ADMIN_A } });
    expect(row.isActive).toBe(true);
  });

  it("rejects self-demotion through saveUser", async () => {
    await makeAdmin(ADMIN_B, "b");
    const snapshot = await service.getSnapshot();
    const self = expectDefined(snapshot.users.find((u) => u.id === ADMIN_A));
    await expect(
      service.upsertUser({ ...self, role: "head" }, ADMIN_A),
    ).rejects.toThrow(AdminSelfLockoutError);
  });

  it("rejects deactivating, deleting or demoting the last active administrator", async () => {
    await expect(
      service.deactivateUser(ADMIN_A, "someone-else"),
    ).rejects.toThrow(AdminLastAdminError);
    await expect(service.removeUser(ADMIN_A, "someone-else")).rejects.toThrow(
      AdminLastAdminError,
    );
    const snapshot = await service.getSnapshot();
    const self = expectDefined(snapshot.users.find((u) => u.id === ADMIN_A));
    await expect(
      service.upsertUser({ ...self, role: "head" }, "someone-else"),
    ).rejects.toThrow(AdminLastAdminError);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: ADMIN_A } });
    expect([row.isActive, row.role]).toEqual([true, "admin"]);
  });

  it("allows deactivating an admin while another active admin remains", async () => {
    await makeAdmin(ADMIN_B, "b");
    await service.deactivateUser(ADMIN_A, ADMIN_B);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: ADMIN_A } });
    expect(row.isActive).toBe(false);
    await expect(service.deactivateUser(ADMIN_B, ADMIN_A)).rejects.toThrow(
      AdminLastAdminError,
    );
  });

  it("serializes a concurrent demotion and deactivation of the last two admins", async () => {
    await makeAdmin(ADMIN_B, "b");
    const snapshot = await service.getSnapshot();
    const adminA = expectDefined(snapshot.users.find((u) => u.id === ADMIN_A));
    const locked = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    // Hold the admin-set lock so both writers queue behind it.
    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "role" = 'admin' AND "isActive" = true ORDER BY "id" FOR UPDATE`;
      locked.resolve();
      await release.promise;
    });
    await locked.promise;
    const writes = Promise.allSettled([
      service.upsertUser({ ...adminA, role: "head" }, "someone-else"),
      service.deactivateUser(ADMIN_B, "someone-else"),
    ]);
    release.resolve();
    await holder;
    const results = await writes;
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(AdminLastAdminError);
    expect(
      await prisma.user.count({ where: { role: "admin", isActive: true } }),
    ).toBe(1);
  });

  it("rejects a snapshot restore that would leave no active administrator", async () => {
    const snapshot = await service.getSnapshot();
    const users = snapshot.users.map((u) =>
      u.id === ADMIN_A ? { ...u, isActive: false } : u,
    );
    await expect(
      prisma.$transaction((tx) => upsertUsers(tx, users)),
    ).rejects.toThrow(AdminLastAdminError);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: ADMIN_A } });
    expect(row.isActive).toBe(true);
  });
});
