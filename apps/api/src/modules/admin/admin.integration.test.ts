import { randomUUID } from "node:crypto";

import { composeName, type ReminderPolicy } from "@customreport/shared";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import { AdminUserConflictError } from "./admin-shared";

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
  // Group <-> Product M:M repository methods
  //
  // The seeded `lead` user belongs to `group`; the seeded `project` is
  // led by that user. The backfill auto-creates one `GroupProduct` row
  // mapping the seeded group to the seeded project. These tests assert
  // the four explicit-mutation methods behave idempotently against that
  // real baseline.
  // -------------------------------------------------------------------

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

  // -------------------------------------------------------------------
  // admin-snapshot-head-restore: the whole-snapshot restore path must apply
  // each group's `headUserId`. upsertGroups writes name/description/archived
  // only (a group may be upserted before its head's User row exists), so a
  // second pass after upsertUsers sets the head assignments.
  // -------------------------------------------------------------------

  it("restores a group's headUserId from the snapshot (admin-snapshot-head-restore)", async () => {
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

  it("clears a previously-headed group's headUserId to null on restore (admin-snapshot-head-restore)", async () => {
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

  it("applies a changed headUserId into an existing DB on restore (admin-snapshot-head-restore)", async () => {
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

  // fix-snapshot-restore-policyid: getSnapshot reads a reminder rule's
  // policyId FK, but the restore path built `ruleData` without it, so a
  // policy-derived rule detached from its policy on every restore.
  it("preserves a reminder rule's policyId through a getSnapshot -> saveSnapshot restore (fix-snapshot-restore-policyid)", async () => {
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
    // Drop BOTH the rule and its policy: a fresh-database restore must
    // re-create the policy first or the rule's policyId FK cannot resolve
    // (the original fix without policy restore crashed here with P2003).
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

  // -------------------------------------------------------------------
  // transactional-snapshot-restore: the multi-entity restore is atomic
  // (all-or-nothing) and per-entity admin mutations are targeted by id
  // (never reconcile an unrelated, concurrently-inserted row away).
  // -------------------------------------------------------------------

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

  it("saveSnapshot is additive-only: rows absent from the payload survive (5.7)", async () => {
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

  it("a concurrently-inserted user survives an unrelated targeted edit (5.4)", async () => {
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

  it("a mid-restore failure rolls the whole saveSnapshot back (5.3)", async () => {
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

  it("removeUser honors the FK-reference guard (5.5)", async () => {
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

  it("removeProject archives only the named row (5.5)", async () => {
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

  it("removeReminderRule deletes only the named row (5.5)", async () => {
    const ruleData = {
      kind: "deadline" as const,
      fireAt: new Date("2026-04-11T09:00:00.000Z"),
      timezone: "Europe/Moscow",
      status: "active" as const,
      version: 1,
      reportId: testData.report.id,
    };
    await prisma.reminderRule.create({
      data: { id: TEST_IDS.reminderRule, ...ruleData },
    });
    await prisma.reminderRule.create({
      data: { id: SECOND_RULE_ID, ...ruleData },
    });

    await repo.removeReminderRule(TEST_IDS.reminderRule);

    expect(
      await prisma.reminderRule.findUnique({
        where: { id: TEST_IDS.reminderRule },
      }),
    ).toBeNull();
    expect(
      await prisma.reminderRule.findUnique({ where: { id: SECOND_RULE_ID } }),
    ).not.toBeNull();
  });

  it("upsertPeriod touches only the named period; a concurrent user survives (5.6)", async () => {
    const jit = await prisma.user.create({
      data: {
        ...jitUserData,
        reportingGroupId: testData.lead.reportingGroupId,
      },
    });

    // Edit the seeded period (update branch) — no whole-snapshot rewrite.
    await repo.upsertPeriod({
      id: testData.report.id,
      periodStart: new Date("2026-04-07"),
      periodEnd: new Date("2026-04-13"),
      deadline: new Date("2026-04-12"),
      status: "draft",
    });

    expect(
      await prisma.user.findUnique({ where: { id: jit.id } }),
    ).not.toBeNull();
    const period = expectDefined(
      await prisma.report.findUnique({ where: { id: testData.report.id } }),
    );
    expect(period.deadline.toISOString()).toBe(
      new Date("2026-04-12").toISOString(),
    );
  });

  it("saveStageAssignment resolves two concurrent reassigns atomically, leaving one row (stage-assignment-upsert)", async () => {
    // Both callers target the same stage/project pair with different assignees.
    // The old findFirst-then-create raced: both saw no row, both created, and
    // the loser raised a raw P2002. The composite-unique upsert must instead
    // resolve to a single row with one of the two assignees.
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

  it("upsertPeriod that CREATES a period runs the post-commit applicator (5.6)", async () => {
    const applyToPeriod = vi.fn(() =>
      Promise.resolve({ created: 0, updated: 0, skipped: 0 }),
    );
    const repoWithApplicator = new AdminPrismaRepository(
      prisma as never,
      {
        applyToPeriod,
      } as never,
    );

    const deadline = new Date("2026-05-05T15:00:00.000Z");
    await repoWithApplicator.upsertPeriod({
      id: TEST_IDS.targetReport,
      periodStart: new Date("2026-05-01"),
      periodEnd: new Date("2026-05-07"),
      deadline,
      status: "draft",
    });

    expect(
      await prisma.report.findUnique({ where: { id: TEST_IDS.targetReport } }),
    ).not.toBeNull();
    expect(applyToPeriod).toHaveBeenCalledWith({
      id: TEST_IDS.targetReport,
      deadline,
    });
  });
});
