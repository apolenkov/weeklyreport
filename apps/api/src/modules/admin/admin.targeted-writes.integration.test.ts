import { composeName } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import { AdminUserConflictError } from "./admin-shared";

describe("AdminPrismaRepository (integration) — targeted writes & concurrency", () => {
  const prisma = createTestPrisma();
  const repo = new AdminPrismaRepository(prisma as never);
  // Re-seeded per test after cleanDatabase, so the binding has to be mutable.
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  // Multi-entity restore is atomic; targeted mutations never reconcile concurrent rows away.

  const NONEXISTENT_REPORT_ID = "a0000000-0000-4000-a000-0000000009ff";
  const SECOND_PROJECT_ID = "a0000000-0000-4000-a000-000000000200";
  const SECOND_RULE_ID = "a0000000-0000-4000-a000-000000000620";
  const JIT_USER_ID = "a0000000-0000-4000-a000-0000000000aa";

  const jitUserData = {
    id: JIT_USER_ID,
    email: "jit@test.local",
    name: "JIT User",
    lastName: "Jit",
    firstName: "User",
    role: "lead" as const,
    samlId: "jit-test",
  };

  it("saveSnapshot is additive-only: rows absent from the payload survive", async () => {
    // Capture the snapshot, then insert rows that are NOT part of it.
    const snapshot = await repo.getSnapshot();
    const extraUser = await prisma.user.create({
      data: {
        ...jitUserData,
        reportingGroupId: testData.lead.reportingGroupId,
      },
    });
    const extraProject = await prisma.project.create({
      data: { id: SECOND_PROJECT_ID, name: "Extra", leadId: testData.lead.id },
    });
    const extraRule = await prisma.reminderRule.create({
      data: {
        id: SECOND_RULE_ID,
        kind: "deadline",
        fireAt: new Date("2026-04-11T09:00:00.000Z"),
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
        reportId: testData.report.id,
      },
    });

    // Restoring the older snapshot must NOT delete/archive the absent rows.
    await repo.saveSnapshot(snapshot);

    expect(
      await prisma.user.findUnique({ where: { id: extraUser.id } }),
    ).not.toBeNull();
    const proj = expectDefined(
      await prisma.project.findUnique({ where: { id: extraProject.id } }),
    );
    expect(proj.archived).toBe(false);
    expect(
      await prisma.reminderRule.findUnique({ where: { id: extraRule.id } }),
    ).not.toBeNull();
  });

  it("targeted upsertUser recomputes a drifted name from the structured parts", async () => {
    // The admin UI's user edit now routes through the targeted upsertUser, so
    // the `name === composeName(parts)` invariant must hold on THIS path too,
    // not only the whole-snapshot restore.
    await repo.upsertUser({
      id: testData.lead.id,
      email: "lead1@test.local",
      name: "TOTALLY WRONG DISPLAY NAME",
      lastName: "Иванов",
      firstName: "Пётр",
      middleName: "Сергеевич",
      position: null,
      role: "lead",
      reportingGroupId: testData.lead.reportingGroupId,
      isActive: true,
    });

    const expected = composeName({
      lastName: "Иванов",
      firstName: "Пётр",
      middleName: "Сергеевич",
    });
    const row = expectDefined(
      await prisma.user.findUnique({ where: { id: testData.lead.id } }),
    );
    expect(row.name).toBe(expected);
    expect(row.name).not.toBe("TOTALLY WRONG DISPLAY NAME");
  });

  it("upsertUser preserves samlId when an admin changes the email", async () => {
    const id = "a0000000-0000-4000-a000-0000000000ab";
    const originalEmail = "create-only-identity@test.local";
    const user = {
      id,
      email: originalEmail,
      name: "Create Only",
      lastName: "Create",
      firstName: "Only",
      middleName: null,
      position: null,
      role: "viewer" as const,
      reportingGroupId: null,
      isActive: true,
    };

    await repo.upsertUser(user);
    const created = expectDefined(
      await prisma.user.findUnique({ where: { id } }),
    );

    await repo.upsertUser({ ...user, email: "updated-email@test.local" });

    const updated = expectDefined(
      await prisma.user.findUnique({ where: { id } }),
    );
    expect(updated.email).toBe("updated-email@test.local");
    expect(updated.samlId).toBe(created.samlId);
    expect(updated.samlId).toBe(originalEmail);
  });

  it("upsertUser reports one typed conflict for concurrent identity creation", async () => {
    const email = "concurrent-identity@test.local";
    const user = {
      email,
      name: "Concurrent Identity",
      lastName: "Concurrent",
      firstName: "Identity",
      middleName: null,
      position: null,
      role: "viewer" as const,
      reportingGroupId: null,
      isActive: true,
    };
    const results = await Promise.allSettled([
      repo.upsertUser({
        ...user,
        id: "a0000000-0000-4000-a000-0000000000ac",
      }),
      repo.upsertUser({
        ...user,
        id: "a0000000-0000-4000-a000-0000000000ad",
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = expectDefined(
      results.find(({ status }) => status === "rejected"),
    );
    expect(rejected.status).toBe("rejected");
    if (rejected.status === "rejected") {
      expect(rejected.reason).toBeInstanceOf(AdminUserConflictError);
    }
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  it("a concurrently-inserted user survives an unrelated targeted edit", async () => {
    // A SAML just-in-time user lands while the admin holds a stale read; a
    // targeted project edit must not reconcile it away (it never reads users).
    const jit = await prisma.user.create({
      data: {
        ...jitUserData,
        reportingGroupId: testData.lead.reportingGroupId,
      },
    });

    await repo.upsertProject({
      id: testData.project.id,
      name: "Renamed Project",
      archived: false,
      leadId: testData.lead.id,
      leadName: "Test Lead 1",
    });

    expect(
      await prisma.user.findUnique({ where: { id: jit.id } }),
    ).not.toBeNull();
    const proj = expectDefined(
      await prisma.project.findUnique({ where: { id: testData.project.id } }),
    );
    expect(proj.name).toBe("Renamed Project");
  });

  it("a mid-restore failure rolls the whole saveSnapshot back", async () => {
    const snapshot = await repo.getSnapshot();
    // Rename the lead in an earlier phase, and add a reminder rule whose
    // reportId does not resolve so the LAST phase throws (FK P2003). The whole
    // transaction must roll back, leaving the rename unpersisted.
    const corrupted = {
      ...snapshot,
      users: snapshot.users.map((u) =>
        u.id === testData.lead.id
          ? {
              ...u,
              lastName: "ShouldNotPersist",
              firstName: "Lead",
              middleName: null,
            }
          : u,
      ),
      reminderRules: [
        {
          id: SECOND_RULE_ID,
          reportId: NONEXISTENT_REPORT_ID,
          policyId: null,
          kind: "deadline" as const,
          fireAt: new Date("2026-04-11T09:00:00.000Z"),
          timezone: "Europe/Moscow",
          status: "active" as const,
          version: 1,
        },
      ],
    };

    await expect(repo.saveSnapshot(corrupted)).rejects.toThrow();

    const lead = expectDefined(
      await prisma.user.findUnique({ where: { id: testData.lead.id } }),
    );
    // Untouched: a committed earlier phase would have set lastName.
    expect(lead.lastName).toBe("Test");
    expect(lead.name).toBe("Test Lead 1");
  });

  it("removeUser honors the FK-reference guard", async () => {
    // The seeded lead leads a project and authored a section → not deletable.
    await repo.removeUser(testData.lead.id);
    expect(
      await prisma.user.findUnique({ where: { id: testData.lead.id } }),
    ).not.toBeNull();

    // A reference-free user IS deleted by the same call.
    const free = await prisma.user.create({
      data: {
        ...jitUserData,
        reportingGroupId: testData.lead.reportingGroupId,
      },
    });
    await repo.removeUser(free.id);
    expect(await prisma.user.findUnique({ where: { id: free.id } })).toBeNull();
  });

  it("removeProject archives only the named row", async () => {
    const second = await prisma.project.create({
      data: { id: SECOND_PROJECT_ID, name: "Second", leadId: testData.lead.id },
    });

    await repo.removeProject(testData.project.id);

    const archived = expectDefined(
      await prisma.project.findUnique({ where: { id: testData.project.id } }),
    );
    expect(archived.archived).toBe(true);
    const untouched = expectDefined(
      await prisma.project.findUnique({ where: { id: second.id } }),
    );
    expect(untouched.archived).toBe(false);
  });

  it("saveStageAssignment resolves two concurrent reassigns atomically, leaving one row", async () => {
    // Concurrent first-assigns of the same stage/project must leave one row
    // (composite-unique upsert), not two creates with a raw P2002.
    const stage = await prisma.stage.create({
      data: { id: "a0000000-0000-4000-a000-000000000700", name: "Test Stage" },
    });

    const [first, second] = await Promise.all([
      repo.saveStageAssignment({
        userId: testData.head.id,
        stageId: stage.id,
        projectId: testData.project.id,
      }),
      repo.saveStageAssignment({
        userId: testData.lead.id,
        stageId: stage.id,
        projectId: testData.project.id,
      }),
    ]);

    expect(first.stageId).toBe(stage.id);
    expect(second.stageId).toBe(stage.id);

    const rows = await prisma.stageAssignment.findMany({
      where: { stageId: stage.id, projectId: testData.project.id },
    });
    expect(rows).toHaveLength(1);
    expect([testData.head.id, testData.lead.id]).toContain(
      expectDefined(rows[0]).userId,
    );
  });
});
