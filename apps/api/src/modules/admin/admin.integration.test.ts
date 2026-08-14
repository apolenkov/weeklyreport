import { randomUUID } from "node:crypto";

import { composeName, type ReminderPolicy } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { PolicyApplicatorService } from "../reminders/index.js";
import { AdminPrismaRepository } from "./admin.prisma-repository";

describe("AdminPrismaRepository (integration)", () => {
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

  it("getSnapshot returns users, projects, periods, and rules", async () => {
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

    const leadUser = snapshot.users.find((u) => u.email === "lead1@test.local");
    expect(leadUser).toBeDefined();
    expect(expectDefined(leadUser).name).toBe("Test Lead 1");
    expect(expectDefined(leadUser).role).toBe("lead");

    const proj = snapshot.projects.find((p) => p.name === "Test Project 1");
    expect(proj).toBeDefined();
    expect(expectDefined(proj).leadId).toBe(testData.lead.id);
    expect(expectDefined(proj).leadName).toBe("Test Lead 1");

    const period = snapshot.periods.find((p) => p.id === testData.report.id);
    expect(period).toBeDefined();
    expect(expectDefined(period).status).toBe("draft");
  });

  it("saveSnapshot updates entities correctly", async () => {
    const snapshot = await repo.getSnapshot();

    // The denormalized `name` is recomputed server-side from the structured
    // parts, so setting it directly no longer persists — edit the parts.
    const updatedUsers = snapshot.users.map((u) =>
      u.id === testData.lead.id
        ? {
            ...u,
            lastName: "Updated",
            firstName: "Lead",
            middleName: "Name",
            isActive: false,
          }
        : u,
    );

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

    const savedLead = saved.users.find((u) => u.id === testData.lead.id);
    expect(expectDefined(savedLead).name).toBe("Updated Lead Name");
    expect(expectDefined(savedLead).isActive).toBe(false);

    const savedProject = saved.projects.find(
      (p) => p.id === TEST_IDS.newProject,
    );
    expect(savedProject).toBeDefined();
    expect(expectDefined(savedProject).name).toBe("New Admin Project");
  });

  it("restores a deactivated user through the create branch", async () => {
    await prisma.user.update({
      where: { id: testData.head.id },
      data: { isActive: false },
    });
    const snapshot = await repo.getSnapshot();

    await prisma.user.delete({ where: { id: testData.head.id } });

    const restoredSnapshot = await repo.saveSnapshot(snapshot);
    const restoredUser = expectDefined(
      await prisma.user.findUnique({ where: { id: testData.head.id } }),
    );
    expect(restoredUser.isActive).toBe(false);
    expect(
      expectDefined(
        restoredSnapshot.users.find((user) => user.id === testData.head.id),
      ).isActive,
    ).toBe(false);
  });

  it("restores a deactivated user through the update branch", async () => {
    await prisma.user.update({
      where: { id: testData.head.id },
      data: { isActive: false },
    });
    const snapshot = await repo.getSnapshot();

    await prisma.user.update({
      where: { id: testData.head.id },
      data: { isActive: true },
    });

    await repo.saveSnapshot(snapshot);
    const restoredUser = expectDefined(
      await prisma.user.findUnique({ where: { id: testData.head.id } }),
    );
    expect(restoredUser.isActive).toBe(false);
  });

  // Inverse of the update-branch deactivation pin above: a live inactive row
  // must become active when the snapshot carries isActive: true.
  it("restores a reactivated user through the update branch", async () => {
    await prisma.user.update({
      where: { id: testData.lead.id },
      data: { isActive: false },
    });

    const snapshot = await repo.getSnapshot();
    const reactivatedUsers = snapshot.users.map((u) =>
      u.id === testData.lead.id ? { ...u, isActive: true } : u,
    );

    await repo.saveSnapshot({ ...snapshot, users: reactivatedUsers });

    const restoredUser = expectDefined(
      await prisma.user.findUnique({ where: { id: testData.lead.id } }),
    );
    expect(restoredUser.isActive).toBe(true);
  });

  // Server recomputes User.name from structured parts so clients cannot persist drift.
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

  // Group<->Product baseline: the backfill already maps the seeded group to
  // the seeded project, so these mutations run against a non-empty edge set.

  it("attachProductToGroup is idempotent and detach removes the edge", async () => {
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

  it("attachProductToGroup resolves two concurrent first-attaches to one row", async () => {
    await prisma.groupProduct.deleteMany({});
    const input = {
      groupId: expectDefined(testData.lead.reportingGroupId),
      productId: testData.project.id,
    };

    const [first, second] = await Promise.all([
      repo.attachProductToGroup(input),
      repo.attachProductToGroup(input),
    ]);

    expect(second.id).toBe(first.id);
    const rows = await prisma.groupProduct.findMany({
      where: { productId: input.productId },
    });
    expect(rows).toHaveLength(1);
    expect(expectDefined(rows[0]).id).toBe(first.id);
  });

  it("listProductGroupOwnership resolves owners for many products in one call", async () => {
    await prisma.groupProduct.deleteMany({});
    const leadGroupId = expectDefined(testData.lead.reportingGroupId);
    const unownedId = randomUUID();
    await prisma.project.create({
      data: {
        id: unownedId,
        name: "Unowned integration product",
        leadId: testData.lead.id,
      },
    });

    await repo.attachProductToGroup({
      groupId: leadGroupId,
      productId: testData.project.id,
    });

    const ownership = await repo.listProductGroupOwnership([
      testData.project.id,
      unownedId,
    ]);

    // One entry per requested id, in request order; owned product carries its
    // group, unowned product carries null (never omitted).
    expect(ownership.map((row) => row.productId)).toEqual([
      testData.project.id,
      unownedId,
    ]);
    const owned = ownership.find(
      (row) => row.productId === testData.project.id,
    );
    expect(owned?.group?.id).toBe(leadGroupId);
    const unowned = ownership.find((row) => row.productId === unownedId);
    expect(unowned?.group).toBeNull();
  });

  // getSnapshot → saveSnapshot must preserve the full governed lifecycle set
  // (period-dual-state). CREATE-branch cases delete the row first.

  it("re-creates a published period with its full lifecycle, not flattened", async () => {
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

  it("re-creates a reopened period keeping its three distinct values", async () => {
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

  it("repairs a divergent live period via the update branch", async () => {
    // Capture a healthy published row, then corrupt the live row before restore;
    // the update branch must overwrite the full governed set.
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

  // headUserId is applied in a second pass after users exist (groups upsert first).

  it("restores a group's headUserId from the snapshot", async () => {
    const snapshot = await repo.getSnapshot();
    // Point the seeded group at the head user (a valid head candidate).
    const groups = snapshot.groups.map((g) =>
      g.id === TEST_IDS.group ? { ...g, headUserId: testData.head.id } : g,
    );

    await repo.saveSnapshot({ ...snapshot, groups });

    const restored = await repo.getSnapshot();
    const group = expectDefined(
      restored.groups.find((g) => g.id === TEST_IDS.group),
    );
    expect(group.headUserId).toBe(testData.head.id);
  });

  it("clears a previously-headed group's headUserId to null on restore", async () => {
    // Seed a head on the live group first.
    await prisma.reportingGroup.update({
      where: { id: TEST_IDS.group },
      data: { headUserId: testData.head.id },
    });

    const snapshot = await repo.getSnapshot();
    const groups = snapshot.groups.map((g) =>
      g.id === TEST_IDS.group ? { ...g, headUserId: null } : g,
    );

    await repo.saveSnapshot({ ...snapshot, groups });

    const restored = await repo.getSnapshot();
    const group = expectDefined(
      restored.groups.find((g) => g.id === TEST_IDS.group),
    );
    expect(group.headUserId).toBeNull();
  });

  it("applies a changed headUserId into an existing DB on restore", async () => {
    // Start with the head user leading the group, in the live DB.
    await prisma.reportingGroup.update({
      where: { id: TEST_IDS.group },
      data: { headUserId: testData.head.id },
    });

    // Promote the lead to a head-eligible role so it can lead the group, then
    // capture the snapshot with the new head assignment.
    await prisma.user.update({
      where: { id: testData.lead.id },
      data: { role: "head" },
    });

    const snapshot = await repo.getSnapshot();
    const groups = snapshot.groups.map((g) =>
      g.id === TEST_IDS.group ? { ...g, headUserId: testData.lead.id } : g,
    );

    await repo.saveSnapshot({ ...snapshot, groups });

    const restored = await repo.getSnapshot();
    const group = expectDefined(
      restored.groups.find((g) => g.id === TEST_IDS.group),
    );
    expect(group.headUserId).toBe(testData.lead.id);
  });

  // Restore must carry rule.policyId so derived rules stay attached to policies.
  it("preserves a reminder rule's policyId through a getSnapshot -> saveSnapshot restore", async () => {
    const policyId = "d1111111-1111-4111-8111-111111111111";
    const ruleId = "d2222222-2222-4222-8222-222222222222";

    await prisma.reminderPolicy.create({
      data: {
        id: policyId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
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

    const snapshot = await repo.getSnapshot();
    // Drop both so a fresh-DB restore must re-create policy before the rule FK.
    await prisma.reminderRule.delete({ where: { id: ruleId } });
    await prisma.reminderPolicy.delete({ where: { id: policyId } });

    await repo.saveSnapshot(snapshot);

    const restored = expectDefined(
      await prisma.reminderRule.findUnique({ where: { id: ruleId } }),
    );
    expect(restored.policyId).toBe(policyId);
    const restoredPolicy = expectDefined(
      await prisma.reminderPolicy.findUnique({ where: { id: policyId } }),
    );
    expect(restoredPolicy.audience).toBe("LEAD_WITH_DRAFT");

    // UPDATE branch: strip the FK on the live row, restore again over the
    // existing rule id, and confirm the update re-attaches the policy.
    await prisma.reminderRule.update({
      where: { id: ruleId },
      data: { policyId: null },
    });
    await repo.saveSnapshot(snapshot);
    const reRestored = expectDefined(
      await prisma.reminderRule.findUnique({ where: { id: ruleId } }),
    );
    expect(reRestored.policyId).toBe(policyId);
  });

  // Post-commit applicator must not re-materialize pairs the restore already wrote.
  it("fresh-DB restore keeps a snapshot rule paused instead of re-materializing it active", async () => {
    const policyId = "d3333333-3333-4333-8333-333333333333";
    const ruleId = "d4444444-4444-4444-8444-444444444444";
    const periodId = "d5555555-5555-4555-8555-555555555555";

    await prisma.report.create({
      data: {
        id: periodId,
        periodStart: new Date("2026-03-02"),
        periodEnd: new Date("2026-03-08"),
        // Deadline already past: without the restore-time `now` guard the
        // applicator would also arm elapsed instants as active.
        deadline: new Date("2026-03-06T15:00:00.000Z"),
        status: "draft",
      },
    });
    await prisma.reminderPolicy.create({
      data: {
        id: policyId,
        kind: "deadline",
        offsetMinutes: -1440,
        timezone: "Europe/Moscow",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    await prisma.reminderRule.create({
      data: {
        id: ruleId,
        policyId,
        kind: "deadline",
        fireAt: new Date("2026-03-05T15:00:00.000Z"),
        timezone: "Europe/Moscow",
        status: "paused",
        version: 1,
        reportId: periodId,
      },
    });

    const applicatorRepo = new AdminPrismaRepository(
      prisma as never,
      new PolicyApplicatorService(prisma as never),
    );
    const snapshot = await applicatorRepo.getSnapshot();
    // Fresh-DB path: everything the snapshot carries is absent pre-restore,
    // so the period counts as newly created and the applicator runs.
    await prisma.reminderRule.delete({ where: { id: ruleId } });
    await prisma.reminderPolicy.delete({ where: { id: policyId } });
    await prisma.report.delete({ where: { id: periodId } });

    await applicatorRepo.saveSnapshot(snapshot);

    const restored = expectDefined(
      await prisma.reminderRule.findUnique({ where: { id: ruleId } }),
    );
    expect(restored.status).toBe("paused");
    expect(restored.fireAt).toEqual(new Date("2026-03-05T15:00:00.000Z"));
    // And no duplicate derived rule was materialized for the same pair.
    const pairRules = await prisma.reminderRule.findMany({
      where: { reportId: periodId, policyId },
    });
    expect(pairRules).toHaveLength(1);
  });

  it("attachProductToGroup rejects moving a product from another group", async () => {
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

  // Policy active cascades to derived rules; pause toggle lives on the policy only.
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
        data: {
          id: executionId,
          ruleId,
          recipientEmail: "lead@test.local",
          dedupeKey: `dk-${ruleId}`,
        },
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
