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

    const executions = await repo.listExecutions(TEST_IDS.reminderRule, {
      cursor: null,
      take: 10,
    });

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

  it("transitionExecutionToSending claims a queued row exactly once", async () => {
    await repo.saveExecution(baseExecution(TEST_IDS.reminderExec1, "cas-1"));

    const first = await repo.transitionExecutionToSending(
      TEST_IDS.reminderExec1,
    );
    const second = await repo.transitionExecutionToSending(
      TEST_IDS.reminderExec1,
    );

    // Exactly one caller wins the queued → sending transition.
    expect(first).toBe(true);
    expect(second).toBe(false);

    // The claim is durable and reads back as `sending`.
    const reread = await repo.getExecution(TEST_IDS.reminderExec1);
    expect(reread?.status).toBe("sending");
  });

  it("transitionExecutionToSending does not claim an already-sent row", async () => {
    await repo.saveExecution({
      ...baseExecution(TEST_IDS.reminderExec1, "cas-2"),
      status: "sent",
      sentAt: new Date("2026-04-11T09:00:05.000Z"),
    });

    const claimed = await repo.transitionExecutionToSending(
      TEST_IDS.reminderExec1,
    );

    expect(claimed).toBe(false);
    const reread = await repo.getExecution(TEST_IDS.reminderExec1);
    expect(reread?.status).toBe("sent");
  });

  it("releaseExecutionClaim flips a sending row back to the claimable status", async () => {
    await repo.saveExecution(
      baseExecution(TEST_IDS.reminderExec1, "release-1"),
    );
    const claimed = await repo.transitionExecutionToSending(
      TEST_IDS.reminderExec1,
    );
    expect(claimed).toBe(true);

    await repo.releaseExecutionClaim(TEST_IDS.reminderExec1);

    // Released back to the pre-claim status, so a retry's
    // transitionExecutionToSending can claim it again.
    const reclaimed = await repo.transitionExecutionToSending(
      TEST_IDS.reminderExec1,
    );
    expect(reclaimed).toBe(true);
  });

  it("releaseExecutionClaim is a no-op against an already-sent row", async () => {
    await repo.saveExecution({
      ...baseExecution(TEST_IDS.reminderExec1, "release-2"),
      status: "sent",
      sentAt: new Date("2026-04-11T09:00:05.000Z"),
    });

    await repo.releaseExecutionClaim(TEST_IDS.reminderExec1);

    const reread = await repo.getExecution(TEST_IDS.reminderExec1);
    expect(reread?.status).toBe("sent");
  });

  it("markExecutionFailed records a terminal failure but never clobbers a sent row", async () => {
    await repo.saveExecution(baseExecution(TEST_IDS.reminderExec1, "fail-1"));
    await repo.markExecutionFailed(TEST_IDS.reminderExec1, "SMTP refused");

    const failed = await repo.getExecution(TEST_IDS.reminderExec1);
    expect(failed?.status).toBe("failed");
    expect(failed?.errorMessage).toBe("SMTP refused");

    // A late failure write must not overwrite a row that already reached sent.
    await repo.saveExecution({
      ...baseExecution(TEST_IDS.reminderExec2, "fail-2"),
      status: "sent",
      sentAt: new Date("2026-04-11T09:00:05.000Z"),
    });
    await repo.markExecutionFailed(TEST_IDS.reminderExec2, "too late");
    const stillSent = await repo.getExecution(TEST_IDS.reminderExec2);
    expect(stillSent?.status).toBe("sent");
  });

  it("listStuckQueuedExecutions returns old queued rows and excludes sending / fresh rows", async () => {
    const cutoff = new Date("2026-04-11T12:00:00.000Z");
    const old = new Date("2026-04-11T09:00:00.000Z");
    // Created after the cutoff → within the window, not yet stranded.
    const fresh = new Date("2026-04-11T12:30:00.000Z");

    // Stranded queued row, old enough to reap.
    await prisma.reminderExecution.create({
      data: {
        id: TEST_IDS.reminderExec1,
        ruleId: TEST_IDS.reminderRule,
        dedupeKey: "stuck-queued",
        status: "pending",
        createdAt: old,
      },
    });
    // In-flight send: old, but intentionally NOT reclaimed.
    await prisma.reminderExecution.create({
      data: {
        id: TEST_IDS.reminderExec2,
        ruleId: TEST_IDS.reminderRule,
        dedupeKey: "stuck-sending",
        status: "sending",
        createdAt: old,
      },
    });
    // Freshly queued: within the window, not yet stranded.
    await prisma.reminderExecution.create({
      data: {
        id: "a0000000-0000-4000-a000-0000000000f5",
        ruleId: TEST_IDS.reminderRule,
        dedupeKey: "fresh-queued",
        status: "pending",
        createdAt: fresh,
      },
    });

    const stuck = await repo.listStuckQueuedExecutions(cutoff);

    expect(stuck).toHaveLength(1);
    expect(expectDefined(stuck[0]).id).toBe(TEST_IDS.reminderExec1);
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
    expect(rule?.groups[0]?.lateLeads[0]?.sectionTitle).toBe("Test Group");
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
