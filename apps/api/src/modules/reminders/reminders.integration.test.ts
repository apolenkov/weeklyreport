import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { RemindersPrismaRepository } from "./reminders.prisma-repository";
import type { ReminderQueuePayload } from "./reminders-queue-payload.js";

describe("RemindersPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: RemindersPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new RemindersPrismaRepository(prisma as unknown as PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);

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

  const queuePayload: ReminderQueuePayload = {
    kind: "deadline",
    cycleDate: "2026-04-11",
    leadName: "Test Lead",
    reportPeriod: "2026-04-06 → 2026-04-12",
    deadlineIso: "2026-04-11T09:00:00.000Z",
    sectionUrl: "https://example.test/lead/report",
    organization: {
      shortName: "CustomReport",
      fullName: "CustomReport Department",
    },
  };
  const queuePayloadJson = queuePayload as unknown as Prisma.InputJsonValue;

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("insertExecutionOnConflict creates one execution and persists its payload", async () => {
    const execution = baseExecution(
      TEST_IDS.reminderExec1,
      `${TEST_IDS.reminderRule}-2026-04-11`,
    );

    const createdResult = await repo.insertExecutionOnConflict(
      execution,
      queuePayload,
    );
    expect(createdResult.inserted).toBe(true);
    const created = createdResult.execution;
    expect(created.id).toBe(execution.id);
    expect(created.ruleId).toBe(TEST_IDS.reminderRule);
    expect(created.dedupeKey).toBe(execution.dedupeKey);
    expect(created.status).toBe("queued");

    const persistedPayload = await repo.getExecutionQueuePayload(execution.id);
    expect(persistedPayload).toEqual(queuePayload);

    const duplicate = await repo.insertExecutionOnConflict(
      {
        ...execution,
        id: TEST_IDS.reminderExec2,
      },
      queuePayload,
    );

    expect(duplicate.inserted).toBe(false);
    expect(duplicate.execution.id).toBe(execution.id);

    const allExecutions = await prisma.reminderExecution.findMany({
      where: { dedupeKey: execution.dedupeKey },
    });
    expect(allExecutions).toHaveLength(1);
  });

  it("listExecutions returns executions ordered by createdAt", async () => {
    await prisma.reminderExecution.create({
      data: {
        id: TEST_IDS.reminderExec1,
        ruleId: TEST_IDS.reminderRule,
        recipientEmail: "lead-a@test.local",
        dedupeKey: `${TEST_IDS.reminderRule}-2026-04-04`,
        status: "sent",
        sentAt: new Date("2026-04-04T09:00:00.000Z"),
        queuePayload: queuePayloadJson,
      },
    });

    await prisma.reminderExecution.create({
      data: {
        id: TEST_IDS.reminderExec2,
        ruleId: TEST_IDS.reminderRule,
        recipientEmail: "lead-b@test.local",
        dedupeKey: `${TEST_IDS.reminderRule}-2026-04-11`,
        status: "pending",
        queuePayload: queuePayloadJson,
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
      queuePayload,
    );
    expect(first.inserted).toBe(true);

    const second = await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec2, "dup-1"),
      queuePayload,
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
        queuePayload,
      ),
      repo.insertExecutionOnConflict(
        baseExecution(TEST_IDS.reminderExec2, "dup-2"),
        queuePayload,
      ),
    ]);

    expect(results.filter((r) => r.inserted)).toHaveLength(1);
    const rows = await prisma.reminderExecution.findMany({
      where: { dedupeKey: "dup-2" },
    });
    expect(rows).toHaveLength(1);
  });

  it("transitionExecutionToSending claims a queued row exactly once", async () => {
    await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec1, "cas-1"),
      queuePayload,
    );

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
    await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec1, "cas-2"),
      queuePayload,
    );
    expect(
      await repo.transitionExecutionToSending(TEST_IDS.reminderExec1),
    ).toBe(true);
    expect(
      await repo.markExecutionSent(
        TEST_IDS.reminderExec1,
        new Date("2026-04-11T09:00:05.000Z"),
      ),
    ).not.toBeNull();

    const claimed = await repo.transitionExecutionToSending(
      TEST_IDS.reminderExec1,
    );

    expect(claimed).toBe(false);
    const reread = await repo.getExecution(TEST_IDS.reminderExec1);
    expect(reread?.status).toBe("sent");
  });

  it("releaseExecutionClaim flips a sending row back to the claimable status", async () => {
    await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec1, "release-1"),
      queuePayload,
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
    await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec1, "release-2"),
      queuePayload,
    );
    expect(
      await repo.transitionExecutionToSending(TEST_IDS.reminderExec1),
    ).toBe(true);
    expect(
      await repo.markExecutionSent(
        TEST_IDS.reminderExec1,
        new Date("2026-04-11T09:00:05.000Z"),
      ),
    ).not.toBeNull();

    await repo.releaseExecutionClaim(TEST_IDS.reminderExec1);

    const reread = await repo.getExecution(TEST_IDS.reminderExec1);
    expect(reread?.status).toBe("sent");
  });

  it("markExecutionFailed records a terminal failure but never clobbers a sent row", async () => {
    await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec1, "fail-1"),
      queuePayload,
    );
    await repo.markExecutionFailed(TEST_IDS.reminderExec1, "SMTP refused");

    const failed = await repo.getExecution(TEST_IDS.reminderExec1);
    expect(failed?.status).toBe("failed");
    expect(failed?.errorMessage).toBe("SMTP refused");

    // A late failure write must not overwrite a row that already reached sent.
    await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec2, "fail-2"),
      queuePayload,
    );
    expect(
      await repo.transitionExecutionToSending(TEST_IDS.reminderExec2),
    ).toBe(true);
    expect(
      await repo.markExecutionSent(
        TEST_IDS.reminderExec2,
        new Date("2026-04-11T09:00:05.000Z"),
      ),
    ).not.toBeNull();
    await repo.markExecutionFailed(TEST_IDS.reminderExec2, "too late");
    const stillSent = await repo.getExecution(TEST_IDS.reminderExec2);
    expect(stillSent?.status).toBe("sent");
  });

  it("revives a payload-less failed row with one atomic current payload write", async () => {
    await prisma.reminderExecution.create({
      data: {
        id: TEST_IDS.reminderExec1,
        ruleId: TEST_IDS.reminderRule,
        recipientEmail: "lead@test.local",
        dedupeKey: "migrated-failed",
        status: "failed",
        error: "awaiting current-contract redispatch",
      },
    });

    expect(
      await repo.requeueFailedExecution(TEST_IDS.reminderExec1, queuePayload),
    ).toBe(true);

    const revived = await prisma.reminderExecution.findUniqueOrThrow({
      where: { id: TEST_IDS.reminderExec1 },
      select: { status: true, error: true, queuePayload: true },
    });
    expect(revived).toEqual({
      status: "pending",
      error: null,
      queuePayload: queuePayloadJson,
    });
  });

  it("rejects a queued execution without a renderer payload", async () => {
    await expect(
      prisma.reminderExecution.create({
        data: {
          id: TEST_IDS.reminderExec1,
          ruleId: TEST_IDS.reminderRule,
          recipientEmail: "lead@test.local",
          dedupeKey: "payload-less-queued",
          status: "pending",
        },
      }),
    ).rejects.toThrow();
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
        recipientEmail: "lead@test.local",
        dedupeKey: "stuck-queued",
        status: "pending",
        createdAt: old,
        queuePayload: queuePayloadJson,
      },
    });
    // In-flight send: old, but intentionally NOT reclaimed.
    await prisma.reminderExecution.create({
      data: {
        id: TEST_IDS.reminderExec2,
        ruleId: TEST_IDS.reminderRule,
        recipientEmail: "lead@test.local",
        dedupeKey: "stuck-sending",
        status: "sending",
        createdAt: old,
        queuePayload: queuePayloadJson,
      },
    });
    // Freshly queued: within the window, not yet stranded.
    await prisma.reminderExecution.create({
      data: {
        id: "a0000000-0000-4000-a000-0000000000f5",
        ruleId: TEST_IDS.reminderRule,
        recipientEmail: "lead@test.local",
        dedupeKey: "fresh-queued",
        status: "pending",
        createdAt: fresh,
        queuePayload: queuePayloadJson,
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
