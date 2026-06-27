import { composeName, type ReminderPolicy } from "@customreport/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { AdminPrismaRepository } from "./admin.prisma-repository";

describe("AdminPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: AdminPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new AdminPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("getSnapshot returns users, projects, periods, and rules", async () => {
    // Create a reminder rule
    await prisma.reminderRule.create({
      data: {
        id: TEST_IDS.reminderRule,
        kind: "deadline",
        fireAt: new Date("2026-04-11T09:00:00.000Z"),
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
        reportId: testData.report.id,
      },
    });

    const snapshot = await repo.getSnapshot();

    expect(snapshot.users.length).toBeGreaterThanOrEqual(2); // head + lead
    expect(snapshot.projects.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.periods.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.reminderRules.length).toBeGreaterThanOrEqual(1);

    // Verify user fields
    const leadUser = snapshot.users.find((u) => u.email === "lead1@test.local");
    expect(leadUser).toBeDefined();
    expect(expectDefined(leadUser).name).toBe("Test Lead 1");
    expect(expectDefined(leadUser).role).toBe("lead");

    // Verify project fields
    const proj = snapshot.projects.find((p) => p.name === "Test Project 1");
    expect(proj).toBeDefined();
    expect(expectDefined(proj).leadId).toBe(testData.lead.id);
    expect(expectDefined(proj).leadName).toBe("Test Lead 1");

    // Verify period fields
    const period = snapshot.periods.find((p) => p.id === testData.report.id);
    expect(period).toBeDefined();
    expect(expectDefined(period).status).toBe("draft");
  });

  it("saveSnapshot updates entities correctly", async () => {
    const snapshot = await repo.getSnapshot();

    // Modify the snapshot: update the lead's name via the structured parts
    // (the denormalized `name` is recomputed server-side from these parts, so
    // setting `name` directly no longer persists — set the parts that compose
    // to the expected display name).
    const updatedUsers = snapshot.users.map((u) =>
      u.id === testData.lead.id
        ? {
            ...u,
            lastName: "Updated",
            firstName: "Lead",
            middleName: "Name",
          }
        : u,
    );

    // Add a new project
    const updatedProjects = [
      ...snapshot.projects,
      {
        id: TEST_IDS.newProject,
        name: "New Admin Project",
        archived: false,
        leadId: testData.lead.id,
        leadName: "Updated Lead Name",
      },
    ];

    const updatedSnapshot = {
      ...snapshot,
      users: updatedUsers,
      projects: updatedProjects,
    };

    const saved = await repo.saveSnapshot(updatedSnapshot);

    // Verify the lead name was updated
    const savedLead = saved.users.find((u) => u.id === testData.lead.id);
    expect(expectDefined(savedLead).name).toBe("Updated Lead Name");

    // Verify the new project was created
    const savedProject = saved.projects.find(
      (p) => p.id === TEST_IDS.newProject,
    );
    expect(savedProject).toBeDefined();
    expect(expectDefined(savedProject).name).toBe("New Admin Project");
  });

  // add-structured-user-name (review finding P2): the denormalized `User.name`
  // is recomputed from the structured parts SERVER-SIDE on every snapshot write,
  // so a client/import that supplies a name disagreeing with the parts cannot
  // persist drift — the data layer owns the `name === composeName(parts)`
  // invariant, not just the web form mapper.
  it("recomputes a drifted name from the structured parts on saveSnapshot", async () => {
    const snapshot = await repo.getSnapshot();

    const driftedUsers = snapshot.users.map((u) =>
      u.id === testData.lead.id
        ? {
            ...u,
            // Deliberate mismatch: name says one thing, parts say another.
            name: "TOTALLY WRONG DISPLAY NAME",
            lastName: "Иванов",
            firstName: "Пётр",
            middleName: "Сергеевич",
          }
        : u,
    );

    const saved = await repo.saveSnapshot({ ...snapshot, users: driftedUsers });

    const savedLead = expectDefined(
      saved.users.find((u) => u.id === testData.lead.id),
    );
    const expected = composeName({
      lastName: "Иванов",
      firstName: "Пётр",
      middleName: "Сергеевич",
    });
    expect(savedLead.name).toBe(expected);
    expect(savedLead.name).not.toBe("TOTALLY WRONG DISPLAY NAME");

    // The persisted row (not just the returned snapshot) must also be reconciled.
    const dbLead = expectDefined(
      await prisma.user.findUnique({ where: { id: testData.lead.id } }),
    );
    expect(dbLead.name).toBe(expected);
  });

  // -------------------------------------------------------------------
  // UFB-054 (Phase 56-B): Group ↔ Product M:M repository methods
  //
  // The seeded `lead` user belongs to `group`; the seeded `project` is
  // led by that user. After the 56-A backfill there is one auto-created
  // `GroupProduct` row mapping the seeded group to the seeded project.
  // These tests assert the four explicit-mutation methods behave
  // idempotently against that real baseline.
  // -------------------------------------------------------------------

  it("attachProductToGroup is idempotent and detach removes the edge (UFB-054)", async () => {
    // The seed test cleanDatabase wipes GroupProduct too if the helper
    // is up to date; we explicitly cleanup edges for this scenario.
    await prisma.groupProduct.deleteMany({});
    const leadGroupId = expectDefined(testData.lead.reportingGroupId);

    const attached = await repo.attachProductToGroup({
      groupId: leadGroupId,
      productId: testData.project.id,
    });
    expect(attached.groupId).toBe(leadGroupId);
    expect(attached.productId).toBe(testData.project.id);

    // Re-attach returns the same logical row (same tuple) — idempotent.
    const reattached = await repo.attachProductToGroup({
      groupId: leadGroupId,
      productId: testData.project.id,
    });
    expect(reattached.id).toBe(attached.id);

    // listProductGroups and listGroupProducts reflect the edge.
    const groupsForProduct = await repo.listProductGroups(testData.project.id);
    expect(groupsForProduct.map((g) => g.id)).toContain(leadGroupId);

    const productsForGroup = await repo.listGroupProducts(leadGroupId);
    expect(productsForGroup.map((p) => p.id)).toContain(testData.project.id);

    // Detach is a no-op safe operation.
    await repo.detachProductFromGroup({
      groupId: leadGroupId,
      productId: testData.project.id,
    });
    await repo.detachProductFromGroup({
      groupId: leadGroupId,
      productId: testData.project.id,
    });

    const after = await repo.listProductGroups(testData.project.id);
    expect(after.map((g) => g.id)).not.toContain(leadGroupId);
  });

  // -------------------------------------------------------------------
  // fix-snapshot-lifecycle-restore: a snapshot getSnapshot → saveSnapshot
  // round-trip MUST preserve a Report's complete governed lifecycle field
  // set, so a restored period is never left in a state the
  // `period-dual-state` invariant forbids (the bug the
  // refactor-period-transition-writer gate had to exempt).
  // -------------------------------------------------------------------

  // These restore through the CREATE branch (capture → delete → saveSnapshot
  // re-creates the row), which is where the data loss the proposal describes
  // lives: the old create branch wrote only `status` and defaulted
  // periodState='open' even for a published/archived snapshot. Stubbing
  // `resolveLifecycle` to `{ status }` turns both assertions red.

  it("re-creates a published period with its full lifecycle, not flattened (fix-snapshot-lifecycle-restore)", async () => {
    const publishedAt = new Date("2026-04-12T10:00:00.000Z");
    // Promote the seeded period to a fully-published lifecycle state.
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodState: "published",
        periodStatus: "published",
        archived: false,
        autoPublished: true,
        publishedAt,
        publishedById: testData.head.id,
      },
    });

    const snapshot = await repo.getSnapshot();
    // Drop the row so the restore must re-CREATE it (the buggy branch). Its
    // section FK goes first.
    await prisma.reportSection.deleteMany({
      where: { reportId: testData.report.id },
    });
    await prisma.report.delete({ where: { id: testData.report.id } });

    // Full-snapshot restore (users included) so the publishedById FK resolves.
    await repo.saveSnapshot(snapshot);

    const restored = expectDefined(
      await prisma.report.findUnique({ where: { id: testData.report.id } }),
    );
    expect(restored.status).toBe("published");
    expect(restored.periodStatus).toBe("published"); // viewer-visible
    expect(restored.periodState).toBe("published"); // NOT the default 'open'
    expect(restored.archived).toBe(false);
    expect(restored.autoPublished).toBe(true);
    expect(restored.publishedAt?.toISOString()).toBe(publishedAt.toISOString());
    expect(restored.publishedById).toBe(testData.head.id);
  });

  it("re-creates a reopened period keeping its three distinct values (fix-snapshot-lifecycle-restore)", async () => {
    const reopenedAt = new Date("2026-04-20T09:00:00.000Z");
    // A reopened period is the canonical legitimately-divergent row.
    const reopened = await prisma.report.create({
      data: {
        id: TEST_IDS.targetReport,
        periodStart: new Date("2026-04-14"),
        periodEnd: new Date("2026-04-20"),
        deadline: new Date("2026-04-18"),
        status: "published",
        periodState: "open",
        periodStatus: "reopened",
        archived: false,
        publishedAt: new Date("2026-04-19T10:00:00.000Z"),
        publishedById: testData.head.id,
        reopenedAt,
      },
    });

    const snapshot = await repo.getSnapshot();
    // No section on this row — delete it directly so the restore re-CREATEs it.
    await prisma.report.delete({ where: { id: reopened.id } });

    await repo.saveSnapshot(snapshot);

    const restored = expectDefined(
      await prisma.report.findUnique({ where: { id: reopened.id } }),
    );
    // Deriving any machine from another would flatten the row: status from
    // periodState='open' would flip status to "draft"; periodStatus would
    // default to "open", losing the reopen flavour. The restore must NOT.
    expect(restored.status).toBe("published");
    expect(restored.periodState).toBe("open");
    expect(restored.periodStatus).toBe("reopened");
    expect(restored.reopenedAt?.toISOString()).toBe(reopenedAt.toISOString());
  });

  it("repairs a divergent live period via the update branch (fix-snapshot-lifecycle-restore)", async () => {
    // Capture a healthy published row, then corrupt the LIVE row before
    // restoring. The old update branch wrote only `status`, leaving the
    // corruption in place; the fix overwrites the full governed set.
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodState: "published",
        periodStatus: "published",
      },
    });

    const snapshot = await repo.getSnapshot();

    // Corrupt the persisted lifecycle (row still exists → update branch).
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { periodState: "open", periodStatus: "open" },
    });

    await repo.saveSnapshot(snapshot);

    const restored = expectDefined(
      await prisma.report.findUnique({ where: { id: testData.report.id } }),
    );
    expect(restored.periodState).toBe("published");
    expect(restored.periodStatus).toBe("published");
  });

  it("attachProductToGroup rejects moving a product from another group (UAT v7)", async () => {
    await prisma.groupProduct.deleteMany({});
    const leadGroupId = expectDefined(testData.lead.reportingGroupId);
    const otherGroup = await prisma.reportingGroup.create({
      data: {
        id: "a0000000-0000-4000-a000-000000000301",
        name: "Other Group",
        description: null,
      },
    });

    await repo.attachProductToGroup({
      groupId: leadGroupId,
      productId: testData.project.id,
    });

    await expect(
      repo.attachProductToGroup({
        groupId: otherGroup.id,
        productId: testData.project.id,
      }),
    ).rejects.toThrow(/already attached to Test Group/);

    const groups = await repo.listProductGroups(testData.project.id);
    expect(groups.map((g) => g.id)).toEqual([testData.lead.reportingGroupId]);
  });

  // cleanup-dead-enum-states: `ReminderRuleStatus.paused` is written by
  // cascading a policy's `active` flag onto its derived rules. The pause
  // toggle lives on the policy (the only editable surface); the derived
  // ReminderRule rows are read-only and mirror the policy state.
  describe("reminder policy active flag cascades to derived rule status", () => {
    const policyId = "c1111111-1111-4111-8111-111111111111";
    const ruleId = "c2222222-2222-4222-8222-222222222222";

    const buildPolicy = (active: boolean): ReminderPolicy => ({
      id: policyId,
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
    });

    const seedActiveRule = async () => {
      await repo.saveReminderPolicy(buildPolicy(true));
      await prisma.reminderRule.create({
        data: {
          id: ruleId,
          policyId,
          kind: "deadline",
          fireAt: new Date("2026-04-11T09:00:00.000Z"),
          timezone: "Europe/Moscow",
          status: "active",
          version: 1,
          reportId: testData.report.id,
        },
      });
    };

    const ruleStatus = async () =>
      (await prisma.reminderRule.findUniqueOrThrow({ where: { id: ruleId } }))
        .status;

    it("saveReminderPolicy(active:false) parks derived rules as paused, and re-activating resumes them", async () => {
      await seedActiveRule();
      expect(await ruleStatus()).toBe("active");

      await repo.saveReminderPolicy(buildPolicy(false));
      expect(await ruleStatus()).toBe("paused");

      await repo.saveReminderPolicy(buildPolicy(true));
      expect(await ruleStatus()).toBe("active");
    });

    it("deleteReminderPolicy hard-deletes the policy, its rules, and their executions", async () => {
      await seedActiveRule();
      // Seed an execution on the rule so the documented cascade (executions
      // follow their rule on delete) is actually exercised.
      const executionId = "c3333333-3333-4333-8333-333333333333";
      await prisma.reminderExecution.create({
        data: { id: executionId, ruleId, dedupeKey: `dk-${ruleId}` },
      });

      await repo.deleteReminderPolicy(policyId);

      expect(
        await prisma.reminderPolicy.findUnique({ where: { id: policyId } }),
      ).toBeNull();
      expect(
        await prisma.reminderRule.findUnique({ where: { id: ruleId } }),
      ).toBeNull();
      expect(
        await prisma.reminderExecution.findUnique({
          where: { id: executionId },
        }),
      ).toBeNull();
    });
  });
});
