import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { RemindersPrismaRepository } from "./reminders.prisma-repository";

describe("RemindersPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: RemindersPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new RemindersPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);

    // Create a reminder rule for this test suite
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
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("saveExecution creates execution with deduplication", async () => {
    const execution = {
      id: TEST_IDS.reminderExec1,
      ruleId: TEST_IDS.reminderRule,
      reportId: testData.report.id,
      dedupeKey: `${TEST_IDS.reminderRule}-2026-04-11`,
      status: "queued" as const,
      scheduledFor: new Date("2026-04-11T09:00:00.000Z"),
      sentAt: null,
      recipientEmail: "",
      errorMessage: null,
    };

    const created = await repo.saveExecution(execution);
    expect(created.id).toBe(execution.id);
    expect(created.ruleId).toBe(TEST_IDS.reminderRule);
    expect(created.dedupeKey).toBe(execution.dedupeKey);
    expect(created.status).toBe("queued");

    // Upsert with same dedupeKey should update, not create duplicate
    const updated = await repo.saveExecution({
      ...execution,
      status: "sent" as const,
      sentAt: new Date("2026-04-11T09:00:05.000Z"),
    });

    expect(updated.dedupeKey).toBe(execution.dedupeKey);
    expect(updated.status).toBe("sent");

    // Verify only one execution exists
    const allExecutions = await prisma.reminderExecution.findMany({
      where: { dedupeKey: execution.dedupeKey },
    });
    expect(allExecutions).toHaveLength(1);
  });

  it("listExecutions returns executions ordered by createdAt", async () => {
    // Create two executions
    await prisma.reminderExecution.create({
      data: {
        id: TEST_IDS.reminderExec1,
        ruleId: TEST_IDS.reminderRule,
        dedupeKey: `${TEST_IDS.reminderRule}-2026-04-04`,
        status: "sent",
        sentAt: new Date("2026-04-04T09:00:00.000Z"),
      },
    });

    await prisma.reminderExecution.create({
      data: {
        id: TEST_IDS.reminderExec2,
        ruleId: TEST_IDS.reminderRule,
        dedupeKey: `${TEST_IDS.reminderRule}-2026-04-11`,
        status: "pending",
      },
    });

    const executions = await repo.listExecutions(TEST_IDS.reminderRule);

    expect(executions).toHaveLength(2);
    // Most recent first (ordered by createdAt desc)
    expect(expectDefined(executions[0]).id).toBe(TEST_IDS.reminderExec2);
    expect(expectDefined(executions[1]).id).toBe(TEST_IDS.reminderExec1);
  });

  const ESC_RULE = "a0000000-0000-4000-a000-000000000620";
  const ESC_NOW = new Date("2026-04-11T13:00:00.000Z");

  async function createEscalationRule(id: string): Promise<void> {
    await prisma.reminderRule.create({
      data: {
        id,
        kind: "escalation",
        fireAt: new Date("2026-04-11T11:00:00.000Z"),
        timezone: "UTC",
        status: "active",
        version: 1,
        reportId: testData.report.id,
      },
    });
  }

  function baseExecution(id: string, dedupeKey: string) {
    return {
      id,
      ruleId: TEST_IDS.reminderRule,
      reportId: testData.report.id,
      dedupeKey,
      status: "queued" as const,
      scheduledFor: new Date("2026-04-11T09:00:00.000Z"),
      sentAt: null,
      recipientEmail: "",
      errorMessage: null,
    };
  }

  it("insertExecutionOnConflict: duplicate dedupeKey inserts once and reports inserted=false", async () => {
    const first = await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec1, "dup-1"),
    );
    expect(first.inserted).toBe(true);

    const second = await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec2, "dup-1"),
    );
    expect(second.inserted).toBe(false);
    // The existing row is returned, not the second caller's fresh id.
    expect(second.execution.id).toBe(TEST_IDS.reminderExec1);

    const rows = await prisma.reminderExecution.findMany({
      where: { dedupeKey: "dup-1" },
    });
    expect(rows).toHaveLength(1);
  });

  it("concurrent insertExecutionOnConflict: exactly one inserts, one row persists", async () => {
    // Races the real pg P2002 path — proves isDedupeKeyConflict matches the
    // driver-adapter error shape (a wrong matcher re-throws and fails here).
    const results = await Promise.all([
      repo.insertExecutionOnConflict(
        baseExecution(TEST_IDS.reminderExec1, "dup-2"),
      ),
      repo.insertExecutionOnConflict(
        baseExecution(TEST_IDS.reminderExec2, "dup-2"),
      ),
    ]);

    expect(results.filter((r) => r.inserted)).toHaveLength(1);
    const rows = await prisma.reminderExecution.findMany({
      where: { dedupeKey: "dup-2" },
    });
    expect(rows).toHaveLength(1);
  });

  it("escalation resolves the late lead's group head for an unpublished period", async () => {
    // publishedBy is null on the seed report — the old publisher-based path
    // would drop this digest entirely.
    expect(testData.report.publishedById).toBeNull();
    await prisma.reportingGroup.update({
      where: { id: TEST_IDS.group },
      data: { headUserId: testData.head.id },
    });
    await createEscalationRule(ESC_RULE);

    const due = await repo.findDueEscalationRules(ESC_NOW);
    const rule = due.find((r) => r.id === ESC_RULE);

    expect(rule).toBeDefined();
    expect(rule?.groups).toHaveLength(1);
    expect(rule?.groups[0]?.head.email).toBe(testData.head.email);
    expect(rule?.groups[0]?.lateLeads).toHaveLength(1);
  });

  it("escalation: head-less group produces no digest", async () => {
    // group.headUserId stays null from the seed.
    await createEscalationRule(ESC_RULE);

    const due = await repo.findDueEscalationRules(ESC_NOW);

    expect(due.find((r) => r.id === ESC_RULE)).toBeUndefined();
  });

  it("escalation: a deactivated group head produces no digest", async () => {
    await prisma.reportingGroup.update({
      where: { id: TEST_IDS.group },
      data: { headUserId: testData.head.id },
    });
    await prisma.user.update({
      where: { id: testData.head.id },
      data: { isActive: false },
    });
    await createEscalationRule(ESC_RULE);

    const due = await repo.findDueEscalationRules(ESC_NOW);

    expect(due.find((r) => r.id === ESC_RULE)).toBeUndefined();
  });

  it("escalation: an admin-role group head still receives the digest", async () => {
    await prisma.user.update({
      where: { id: testData.head.id },
      data: { role: "admin" },
    });
    await prisma.reportingGroup.update({
      where: { id: TEST_IDS.group },
      data: { headUserId: testData.head.id },
    });
    await createEscalationRule(ESC_RULE);

    const due = await repo.findDueEscalationRules(ESC_NOW);
    const rule = due.find((r) => r.id === ESC_RULE);

    expect(rule?.groups).toHaveLength(1);
    expect(rule?.groups[0]?.head.userId).toBe(testData.head.id);
  });

  it("escalation: one head leading two late groups gets a single digest with both leads", async () => {
    const group2 = "a0000000-0000-4000-a000-000000000092";
    const lead2 = "a0000000-0000-4000-a000-000000000094";
    await prisma.reportingGroup.create({
      data: { id: group2, name: "Group 2" },
    });
    await prisma.user.create({
      data: {
        id: lead2,
        email: "lead2@test.local",
        name: "Test Lead 2",
        lastName: "Test",
        firstName: "Lead2",
        role: "lead",
        samlId: "lead-test-2",
        reportingGroupId: group2,
      },
    });
    await prisma.reportSection.create({
      data: { reportId: testData.report.id, authorId: lead2, status: "draft" },
    });
    // Both groups point at the SAME head — the per-head dedupe key means two
    // digests would collapse and drop one group's leads, so they MUST merge.
    await prisma.reportingGroup.update({
      where: { id: TEST_IDS.group },
      data: { headUserId: testData.head.id },
    });
    await prisma.reportingGroup.update({
      where: { id: group2 },
      data: { headUserId: testData.head.id },
    });
    await createEscalationRule(ESC_RULE);

    const due = await repo.findDueEscalationRules(ESC_NOW);
    const rule = due.find((r) => r.id === ESC_RULE);

    expect(rule?.groups).toHaveLength(1);
    expect(rule?.groups[0]?.lateLeads).toHaveLength(2);
  });
});
