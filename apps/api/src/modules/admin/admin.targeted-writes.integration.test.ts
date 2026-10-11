import { composeName, type ReminderPolicy } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  createPauseGate,
  pauseBeforeTransaction,
} from "../../test-utils/paused-prisma.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { ensureLeadSection } from "../report-sections/index.js";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import {
  AdminUserConflictError,
  AdminUserPublishedHistoryError,
} from "./admin-shared";

const LOCK_WAIT_POLL_MS = 25;
const LOCK_WAIT_TIMEOUT_MS = 10_000;

// Stage-assignment writers queue on the same editable-Report row locks that
// section saves and carry-over hold. A blocked `FROM "Report" ... FOR UPDATE`
// on another session is the observable condition — bounded poll, never a
// fixed sleep as evidence.
async function waitForReportLockWaiter(
  prisma: ReturnType<typeof createTestPrisma>,
): Promise<void> {
  const deadline = Date.now() + LOCK_WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const waiting = await prisma.$queryRaw<{ pid: number }[]>`
      SELECT activity.pid
      FROM pg_stat_activity AS activity
      JOIN pg_locks AS lock
        ON lock.pid = activity.pid AND NOT lock.granted
      WHERE activity.datname = current_database()
        AND activity.pid <> pg_backend_pid()
        AND activity.query LIKE '%FROM "Report"%'
        AND activity.query LIKE '%FOR UPDATE%'`;
    if (waiting.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, LOCK_WAIT_POLL_MS));
  }
  throw new Error(
    `Timed out after ${String(LOCK_WAIT_TIMEOUT_MS)}ms waiting for the stage-assignment write to block on a Report lock`,
  );
}

// Holds the Report row lock an editable-section write/carry-over would hold,
// so a stage-assignment writer must queue behind it.
async function holdEditableReportLock(
  prisma: ReturnType<typeof createTestPrisma>,
  reportId: string,
): Promise<{ holder: Promise<unknown>; release: () => void }> {
  const locked = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const holder = prisma.$transaction(
    async (tx) => {
      // Bound the FOR UPDATE at the PG level too — Prisma's callback deadline
      // cannot interrupt an in-flight lock wait, and the acquisition-failure
      // path below awaits this transaction before rethrowing.
      await tx.$executeRaw`SET LOCAL lock_timeout = '5s'`;
      await tx.$queryRaw`
        SELECT "id" FROM "Report" WHERE "id" = ${reportId} FOR UPDATE
      `;
      locked.resolve();
      await release.promise;
    },
    // The waiter poll may run the full LOCK_WAIT_TIMEOUT_MS while held.
    { timeout: 15_000 },
  );
  // Observe the holder immediately: a transaction that fails before acquiring
  // the lock must not leave its rejection unhandled while acquisition waits.
  void holder.catch(() => undefined);
  const acquisitionTimeout = Promise.withResolvers<never>();
  const timer = setTimeout(
    () =>
      acquisitionTimeout.reject(
        new Error(
          `Timed out after ${String(LOCK_WAIT_TIMEOUT_MS)}ms acquiring the Report row lock`,
        ),
      ),
    LOCK_WAIT_TIMEOUT_MS,
  );
  try {
    // A failed acquisition rejects `holder` before `locked` resolves — racing
    // both keeps the caller from hanging on a lock that will never arrive.
    await Promise.race([locked.promise, holder, acquisitionTimeout.promise]);
  } catch (error) {
    release.resolve();
    await Promise.allSettled([holder]);
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return { holder, release: release.resolve };
}

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
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  // Multi-entity restore is atomic; targeted mutations never reconcile concurrent rows away.

  const NONEXISTENT_REPORT_ID = "a0000000-0000-4000-a000-0000000009ff";
  const SECOND_PROJECT_ID = "a0000000-0000-4000-a000-000000000200";
  const SECOND_RULE_ID = "a0000000-0000-4000-a000-000000000620";
  const SECOND_POLICY_ID = "a0000000-0000-4000-a000-000000000621";
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
    await prisma.reminderPolicy.create({
      data: {
        id: SECOND_POLICY_ID,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const extraRule = await prisma.reminderRule.create({
      data: {
        id: SECOND_RULE_ID,
        policyId: SECOND_POLICY_ID,
        kind: "deadline",
        fireAt: new Date("2026-04-11T09:00:00.000Z"),
        deadline: expectDefined(testData.report.deadline),
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

  it("reconciles only editable project statuses during a snapshot lead restore", async () => {
    const leadBId = "a0000000-0000-4000-a000-0000000000b1";
    const publishedReportId = "a0000000-0000-4000-a000-0000000000b2";
    const archivedReportId = "a0000000-0000-4000-a000-0000000000b3";
    const publishedAt = new Date("2026-04-12T10:00:00.000Z");
    await prisma.user.create({
      data: {
        id: leadBId,
        email: "lead2@test.local",
        name: "Test Lead 2",
        lastName: "Test",
        firstName: "Lead 2",
        role: "lead",
        samlId: "lead-test-2",
        reportingGroupId: testData.lead.reportingGroupId,
      },
    });
    const [published, archived] = await prisma.$transaction([
      prisma.report.create({
        data: {
          id: publishedReportId,
          periodStart: new Date("2026-04-14"),
          periodEnd: new Date("2026-04-20"),
          deadline: new Date("2026-04-18"),
          status: "published",
          periodStatus: "published",
          periodState: "published",
          publishedAt,
          publishedSnapshot: publishedSnapshotFixture({
            reportId: publishedReportId,
            periodStart: "2026-04-14",
            periodEnd: "2026-04-20",
            deadline: "2026-04-18",
            publishedAt,
          }),
        },
      }),
      prisma.report.create({
        data: {
          id: archivedReportId,
          periodStart: new Date("2026-04-21"),
          periodEnd: new Date("2026-04-27"),
          deadline: new Date("2026-04-25"),
          status: "draft",
          periodStatus: "open",
          periodState: "archived",
          archived: true,
        },
      }),
    ]);
    const publishedA = await prisma.reportSection.create({
      data: { reportId: published.id, authorId: testData.lead.id },
    });
    const archivedA = await prisma.reportSection.create({
      data: { reportId: archived.id, authorId: testData.lead.id },
    });
    await prisma.projectStatus.createMany({
      data: [
        {
          reportSectionId: testData.section.id,
          projectId: testData.project.id,
          status: "red",
        },
        {
          reportSectionId: publishedA.id,
          projectId: testData.project.id,
          status: "red",
        },
        {
          reportSectionId: archivedA.id,
          projectId: testData.project.id,
          status: "red",
        },
      ],
    });
    const editableB = await prisma.reportSection.create({
      data: { reportId: testData.report.id, authorId: leadBId },
    });

    const snapshot = await repo.getSnapshot();
    await repo.saveSnapshot({
      ...snapshot,
      projects: snapshot.projects.map((project) =>
        project.id === testData.project.id
          ? { ...project, leadId: leadBId, leadName: "Test Lead 2" }
          : project,
      ),
    });

    await expect(
      prisma.projectStatus.findUnique({
        where: {
          reportSectionId_projectId: {
            reportSectionId: testData.section.id,
            projectId: testData.project.id,
          },
        },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.projectStatus.findUnique({
        where: {
          reportSectionId_projectId: {
            reportSectionId: editableB.id,
            projectId: testData.project.id,
          },
        },
      }),
    ).resolves.toMatchObject({ status: null });
    await expect(
      prisma.projectStatus.findUnique({
        where: {
          reportSectionId_projectId: {
            reportSectionId: publishedA.id,
            projectId: testData.project.id,
          },
        },
      }),
    ).resolves.toMatchObject({ status: "red" });
    await expect(
      prisma.projectStatus.findUnique({
        where: {
          reportSectionId_projectId: {
            reportSectionId: archivedA.id,
            projectId: testData.project.id,
          },
        },
      }),
    ).resolves.toMatchObject({ status: "red" });
  });

  it.each(["assignment-first", "provisioning-first"] as const)(
    "does not deadlock when project assignment overlaps first section provisioning (%s)",
    async (order) => {
      const leadBId = "a0000000-0000-4000-8000-0000000002b1";
      await prisma.user.create({
        data: {
          id: leadBId,
          email: "deadlock-lead-b@test.local",
          name: "Deadlock Lead B",
          lastName: "Lead",
          firstName: "B",
          role: "lead",
          samlId: "deadlock-lead-b",
          reportingGroupId: testData.lead.reportingGroupId,
        },
      });
      await prisma.reportSection.delete({ where: { id: testData.section.id } });

      if (order === "provisioning-first") {
        await ensureLeadSection(prisma, testData.report.id, testData.lead.id);
        await prisma.reportSection.deleteMany({
          where: { reportId: testData.report.id },
        });
      }
      // The status graph is globally serialized. Pause before opening the
      // assignment transaction so the test can choose which writer acquires
      // that lane first without holding it while another writer waits.
      const assignmentGate = createPauseGate();
      const assignmentPrisma = pauseBeforeTransaction(
        prisma,
        assignmentGate.pause,
      );
      const assignmentRepository = new AdminPrismaRepository(
        assignmentPrisma as never,
      );
      const assignment = () =>
        assignmentRepository.upsertProject({
          id: testData.project.id,
          name: testData.project.name,
          archived: false,
          leadId: leadBId,
          leadName: "Deadlock Lead B",
        });
      const assignmentPromise = assignment();
      const newReportId = "a0000000-0000-4000-8000-0000000002b2";
      await prisma.report.create({
        data: {
          id: newReportId,
          periodStart: new Date("2026-05-04"),
          periodEnd: new Date("2026-05-10"),
          deadline: new Date("2026-05-08"),
          status: "draft",
          periodStatus: "open",
          periodState: "open",
        },
      });
      await assignmentGate.paused;
      const provision = () =>
        ensureLeadSection(prisma, newReportId, testData.lead.id);
      let provisioningPromise: ReturnType<typeof provision>;
      if (order === "assignment-first") {
        assignmentGate.release();
        await assignmentPromise;
        provisioningPromise = provision();
      } else {
        provisioningPromise = provision();
        await provisioningPromise;
        assignmentGate.release();
      }
      await expect(
        Promise.all([assignmentPromise, provisioningPromise]),
      ).resolves.toBeDefined();

      const currentSection = await prisma.reportSection.findUnique({
        where: {
          reportId_authorId: {
            reportId: testData.report.id,
            authorId: testData.lead.id,
          },
        },
        select: { id: true },
      });
      // The fixture deliberately removes the original section. The only
      // first-provisioning write in this race targets the newly created report.
      expect(currentSection).toBeNull();
      await expect(
        prisma.project.findUnique({
          where: { id: testData.project.id },
          select: { leadId: true },
        }),
      ).resolves.toEqual({ leadId: leadBId });
      const newSection = await prisma.reportSection.findUniqueOrThrow({
        where: {
          reportId_authorId: {
            reportId: newReportId,
            authorId: testData.lead.id,
          },
        },
        select: { id: true },
      });
      await expect(
        prisma.projectStatus.count({
          where: {
            reportSectionId: newSection.id,
            projectId: testData.project.id,
          },
        }),
      ).resolves.toBe(0);
    },
  );

  it("targeted upsertUser recomputes a drifted name from the structured parts", async () => {
    // Targeted user writes recompute the denormalized name from structured
    // parts, preserving the `name === composeName(parts)` invariant.
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

  it("upsertUser reports a typed conflict for a case-variant email of an existing user", async () => {
    const user = {
      name: "Case Variant",
      lastName: "Variant",
      firstName: "Case",
      middleName: null,
      position: null,
      role: "viewer" as const,
      reportingGroupId: null,
      isActive: true,
    };
    await repo.upsertUser({
      ...user,
      id: "a0000000-0000-4000-a000-0000000000ae",
      email: "Case-Variant@Test.Local",
    });

    await expect(
      repo.upsertUser({
        ...user,
        id: "a0000000-0000-4000-a000-0000000000af",
        email: "case-variant@test.local",
      }),
    ).rejects.toBeInstanceOf(AdminUserConflictError);
    expect(
      await prisma.user.count({ where: { email: "case-variant@test.local" } }),
    ).toBe(1);
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

  it("rejects an invalid reminder cross-reference before applying user edits", async () => {
    const snapshot = await repo.getSnapshot();
    const policy: ReminderPolicy = {
      id: SECOND_POLICY_ID,
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active: true,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
    };
    // The user edit must not start when a rule points outside the snapshot's
    // report set; shared validation fails before the transaction opens.
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
          policyId: SECOND_POLICY_ID,
          kind: "deadline" as const,
          fireAt: new Date("2026-04-11T09:00:00.000Z"),
          deadline: new Date("2026-04-12T09:00:00.000Z"),
          timezone: "Europe/Moscow",
          status: "active" as const,
          version: 1,
        },
      ],
      policies: [...snapshot.policies, policy],
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
    // The seeded lead leads a project and authored a section → conflict,
    // and the row is retained.
    await expect(repo.removeUser(testData.lead.id)).rejects.toBeInstanceOf(
      AdminUserConflictError,
    );
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

  it("retains a published-report publisher while allowing deactivation and snapshot export", async () => {
    const publishedAt = new Date("2026-04-12T10:00:00.000Z");
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodState: "published",
        periodStatus: "published",
        publishedAt,
        publishedById: testData.head.id,
        publishedSnapshot: publishedSnapshotFixture({
          reportId: testData.report.id,
          periodStart: testData.report.periodStart,
          periodEnd: testData.report.periodEnd,
          deadline: testData.report.deadline,
          publishedAt,
          publishedById: testData.head.id,
          publishedByName: testData.head.name,
        }),
      },
    });

    await expect(
      prisma.user.delete({ where: { id: testData.head.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(repo.removeUser(testData.head.id)).rejects.toBeInstanceOf(
      AdminUserPublishedHistoryError,
    );

    await repo.deactivateUser(testData.head.id);
    const snapshot = await repo.getSnapshot();
    const publisher = expectDefined(
      snapshot.users.find((user) => user.id === testData.head.id),
    );
    const publishedPeriod = expectDefined(
      snapshot.periods.find((period) => period.id === testData.report.id),
    );

    expect(publisher.isActive).toBe(false);
    expect(publishedPeriod.publishedById).toBe(testData.head.id);
    expect(publishedPeriod.publishedSnapshot?.publishedById).toBe(
      testData.head.id,
    );
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

  it("deleteStageAssignment queues behind a held editable-report lock", async () => {
    const stage = await prisma.stage.create({
      data: {
        id: "a0000000-0000-4000-a000-000000000701",
        name: "Serialization Stage",
      },
    });
    const assignment = await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        stageId: stage.id,
        projectId: testData.project.id,
      },
    });
    const held = await holdEditableReportLock(prisma, testData.report.id);

    const deletion = repo.deleteStageAssignment(assignment.id);
    // Observe immediately so an early rejection cannot surface as unhandled
    // while the bounded waiter poll is still running.
    void deletion.catch(() => undefined);
    let waitFailure: Error | undefined;
    try {
      await waitForReportLockWaiter(prisma);
      // Still queued behind the held lock — the row must not be gone yet.
      expect(
        await prisma.stageAssignment.findUnique({
          where: { id: assignment.id },
        }),
      ).not.toBeNull();
    } catch (error) {
      waitFailure =
        error instanceof Error
          ? error
          : new Error(
              "Stage-assignment lock wait failed without an Error object",
            );
    } finally {
      held.release();
    }

    const [holderResult, deleteResult] = await Promise.allSettled([
      held.holder,
      deletion,
    ]);
    if (waitFailure !== undefined) throw waitFailure;
    expect(holderResult.status).toBe("fulfilled");
    expect(deleteResult.status).toBe("fulfilled");
    await expect(
      prisma.stageAssignment.findUnique({ where: { id: assignment.id } }),
    ).resolves.toBeNull();
  });

  it("saveStageAssignment reassign queues behind a held editable-report lock", async () => {
    const stage = await prisma.stage.create({
      data: {
        id: "a0000000-0000-4000-a000-000000000702",
        name: "Reassign Order Stage",
      },
    });
    const assignment = await prisma.stageAssignment.create({
      data: {
        userId: testData.lead.id,
        stageId: stage.id,
        projectId: testData.project.id,
      },
    });
    const held = await holdEditableReportLock(prisma, testData.report.id);

    const reassignment = repo.saveStageAssignment({
      userId: testData.head.id,
      stageId: stage.id,
      projectId: testData.project.id,
    });
    void reassignment.catch(() => undefined);
    let waitFailure: Error | undefined;
    try {
      await waitForReportLockWaiter(prisma);
      // Still queued — the existing row keeps its assignee.
      const row = expectDefined(
        await prisma.stageAssignment.findUnique({
          where: { id: assignment.id },
        }),
      );
      expect(row.userId).toBe(testData.lead.id);
    } catch (error) {
      waitFailure =
        error instanceof Error
          ? error
          : new Error(
              "Stage-assignment lock wait failed without an Error object",
            );
    } finally {
      held.release();
    }

    const [holderResult, saveResult] = await Promise.allSettled([
      held.holder,
      reassignment,
    ]);
    if (waitFailure !== undefined) throw waitFailure;
    expect(holderResult.status).toBe("fulfilled");
    expect(saveResult.status).toBe("fulfilled");
    if (saveResult.status === "fulfilled") {
      expect(saveResult.value.userId).toBe(testData.head.id);
    }
    const row = expectDefined(
      await prisma.stageAssignment.findUnique({
        where: { id: assignment.id },
      }),
    );
    expect(row.userId).toBe(testData.head.id);
  });
});
