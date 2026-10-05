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
});
