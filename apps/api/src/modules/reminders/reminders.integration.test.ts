import { Prisma } from "@prisma/client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../lib/logger";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { saveReminderPolicy } from "../admin/admin-reminder-policy.queries.js";
import { RemindersPrismaRepository } from "./reminders.prisma-repository";
import { RemindersService } from "./reminders.service.js";
import {
  insertExecutionOnConflict,
  UNCERTAIN_DELIVERY_ERROR,
} from "./reminders-execution.prisma-query.js";
import type { ReminderQueuePayload } from "./reminders-queue-payload.js";

const DEADLINE_POLICY_ID = "a0000000-0000-4000-a000-000000000703";
const ESCALATION_POLICY_ID = "a0000000-0000-4000-a000-000000000704";
const CYCLE_DATE_TIMEZONE_CASES = [
  { sessionZone: "UTC", fireAtIso: "2026-04-07T00:30:00.000Z" },
  { sessionZone: "Europe/Moscow", fireAtIso: "2026-04-07T00:30:00.000Z" },
  { sessionZone: "America/New_York", fireAtIso: "2026-04-07T00:30:00.000Z" },
  { sessionZone: "UTC", fireAtIso: "2026-04-07T23:30:00.000Z" },
  { sessionZone: "Europe/Moscow", fireAtIso: "2026-04-07T23:30:00.000Z" },
  { sessionZone: "America/New_York", fireAtIso: "2026-04-07T23:30:00.000Z" },
] as const;

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

    await prisma.reminderPolicy.createMany({
      data: [
        {
          id: DEADLINE_POLICY_ID,
          kind: "deadline",
          offsetMinutes: 540,
          timezone: "Europe/Moscow",
          audience: "LEAD_WITH_DRAFT",
          active: true,
          // The fixture deadline is historical; Prisma's default validFrom is
          // the insertion clock and would make every rule ineligible.
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
        {
          id: ESCALATION_POLICY_ID,
          kind: "escalation",
          offsetMinutes: 660,
          timezone: "UTC",
          audience: "HEAD_OF_LATE",
          active: true,
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    await prisma.reminderRule.create({
      data: {
        id: TEST_IDS.reminderRule,
        policyId: DEADLINE_POLICY_ID,
        kind: "deadline",
        fireAt: new Date("2026-04-11T09:00:00.000Z"),
        deadline: expectDefined(testData.report.deadline),
        timezone: "Europe/Moscow",
        status: "active",
        version: 1,
        reportId: testData.report.id,
      },
    });
  });

  const queuePayload: ReminderQueuePayload = {
    contractVersion: 1,
    kind: "deadline",
    cycleDate: "2026-04-11",
    leadName: "Test Lead",
    reportPeriod: "2026-04-06 → 2026-04-12",
    deadlineIso: "2026-04-11T00:00:00.000Z",
    sectionUrl: "https://example.test/lead/report",
    organization: {
      shortName: "CustomReport",
      fullName: "CustomReport Department",
    },
  };
  const queuePayloadJson = queuePayload as unknown as Prisma.InputJsonValue;
  const executionPayload = {
    kind: "deadline" as const,
    cycleDate: queuePayload.cycleDate,
    leadName: queuePayload.leadName,
    reportPeriod: queuePayload.reportPeriod,
    deadlineIso: queuePayload.deadlineIso,
    sectionUrl: queuePayload.sectionUrl,
    organization: queuePayload.organization,
  };

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
    expect(createdResult.outcome).toBe("created");
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

    expect(duplicate.outcome).toBe("deduplicated");
    expect(duplicate.execution.id).toBe(execution.id);

    const allExecutions = await prisma.reminderExecution.findMany({
      where: { dedupeKey: execution.dedupeKey },
    });
    expect(allExecutions).toHaveLength(1);
  });

  it.each(CYCLE_DATE_TIMEZONE_CASES)(
    "keeps UTC cycle-date eligibility in $sessionZone for $fireAtIso",
    async ({ sessionZone, fireAtIso }) => {
      const fireAt = new Date(fireAtIso);
      const cycleDate = "2026-04-07";
      const dedupeKey = `timezone-${sessionZone}-${fireAtIso}`;
      const edgePayload: ReminderQueuePayload = {
        ...queuePayload,
        cycleDate,
        deadlineIso: fireAtIso,
      };

      await prisma.reminderPolicy.update({
        where: { id: DEADLINE_POLICY_ID },
        data: { offsetMinutes: 0, timezone: "UTC" },
      });
      await prisma.report.update({
        where: { id: testData.report.id },
        data: { deadline: fireAt },
      });
      await prisma.reminderRule.update({
        where: { id: TEST_IDS.reminderRule },
        data: { deadline: fireAt, fireAt, timezone: "UTC" },
      });

      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('TimeZone', ${sessionZone}, true)`;
        const transactionBoundPrisma = {
          $transaction: (callback: (client: typeof tx) => Promise<unknown>) =>
            callback(tx),
        };

        return insertExecutionOnConflict(
          transactionBoundPrisma as never,
          {
            id: TEST_IDS.reminderExec1,
            ruleId: TEST_IDS.reminderRule,
            reportId: testData.report.id,
            dedupeKey,
            status: "queued",
            scheduledFor: fireAt,
            sentAt: null,
            recipientEmail: "timezone-edge@example.test",
            errorMessage: null,
          },
          edgePayload,
        );
      });

      expect(result.outcome).toBe("created");
      await expect(
        prisma.reminderExecution.count({ where: { dedupeKey } }),
      ).resolves.toBe(1);
    },
  );

  it("creates nothing when publish wins after due discovery, then allows reopened delivery", async () => {
    const due = await repo.findDueDeadlineRules(
      new Date("2026-04-11T10:00:00.000Z"),
    );
    expect(due.map((rule) => rule.id)).toContain(TEST_IDS.reminderRule);

    const publishedAt = new Date("2026-04-11T10:01:00.000Z");
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

    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = new RemindersService(repo, createNullLogger(), queue);
    await expect(
      service.requestReminderExecutionWithOutcome(
        TEST_IDS.reminderRule,
        testData.lead.email,
        executionPayload,
      ),
    ).resolves.toEqual({ execution: null, outcome: "skipped" });
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(await prisma.reminderExecution.count()).toBe(0);

    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        periodState: "open",
        periodStatus: "reopened",
        reopenedAt: new Date("2026-04-11T10:02:00.000Z"),
      },
    });

    const reopened = await service.requestReminderExecutionWithOutcome(
      TEST_IDS.reminderRule,
      testData.lead.email,
      executionPayload,
    );
    expect(reopened.outcome).toBe("created");
    expect(reopened.execution).not.toBeNull();
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    expect(await prisma.reminderExecution.count()).toBe(1);
  });

  it("creates and sends nothing when policy disable wins after due discovery", async () => {
    const due = await repo.findDueDeadlineRules(
      new Date("2026-04-11T10:00:00.000Z"),
    );
    expect(due.map((rule) => rule.id)).toContain(TEST_IDS.reminderRule);

    await saveReminderPolicy(prisma as unknown as PrismaService, {
      id: DEADLINE_POLICY_ID,
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "lead-with-draft",
      active: false,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
    });

    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = new RemindersService(repo, createNullLogger(), queue);
    await expect(
      service.requestReminderExecutionWithOutcome(
        TEST_IDS.reminderRule,
        testData.lead.email,
        executionPayload,
      ),
    ).rejects.toThrow("Reminder execution requires an active rule.");
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(await prisma.reminderExecution.count()).toBe(0);
  });

  it("rejects a stale deadline payload when the report deadline changes", async () => {
    const [due] = await repo.findDueDeadlineRules(
      new Date("2026-04-11T10:00:00.000Z"),
    );
    expect(due?.deadline).toEqual(testData.report.deadline);

    await prisma.report.update({
      where: { id: testData.report.id },
      data: { deadline: new Date("2026-04-12T00:00:00.000Z") },
    });

    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = new RemindersService(repo, createNullLogger(), queue);
    await expect(
      service.requestReminderExecutionWithOutcome(
        TEST_IDS.reminderRule,
        testData.lead.email,
        executionPayload,
      ),
    ).resolves.toEqual({ execution: null, outcome: "skipped" });
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(await prisma.reminderExecution.count()).toBe(0);
  });

  it("does not revive a failed execution when publish wins after rule lookup", async () => {
    const dedupeKey = `${TEST_IDS.reminderRule}:deadline:${queuePayload.cycleDate}:${testData.lead.email}`;
    await repo.insertExecutionOnConflict(
      {
        ...baseExecution(TEST_IDS.reminderExec1, dedupeKey),
        recipientEmail: testData.lead.email,
      },
      queuePayload,
    );
    await repo.markExecutionFailed(TEST_IDS.reminderExec1, "SMTP refused");

    const publishedAt = new Date("2026-04-11T10:01:00.000Z");
    const getRule = repo.getRule;
    const lookup = vi
      .spyOn(repo, "getRule")
      .mockImplementationOnce(async (id) => {
        const rule = await getRule(id);
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
        return rule;
      });
    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = new RemindersService(repo, createNullLogger(), queue);

    try {
      await expect(
        service.requestReminderExecutionWithOutcome(
          TEST_IDS.reminderRule,
          testData.lead.email,
          executionPayload,
          "manual",
        ),
      ).resolves.toEqual({ execution: null, outcome: "skipped" });
    } finally {
      lookup.mockRestore();
    }
    expect(queue.enqueue).not.toHaveBeenCalled();
    const failed = await repo.getExecution(TEST_IDS.reminderExec1);
    expect(failed?.status).toBe("failed");
    expect(failed?.errorMessage).toBe("SMTP refused");
  });

  it("listExecutions returns executions ordered by createdAt", async () => {
    const firstCreatedAt = new Date("2026-05-01T10:00:00.000Z");
    const secondCreatedAt = new Date("2026-05-02T10:00:00.000Z");
    await prisma.reminderExecution.create({
      data: {
        id: TEST_IDS.reminderExec1,
        ruleId: TEST_IDS.reminderRule,
        recipientEmail: "lead-a@test.local",
        dedupeKey: `${TEST_IDS.reminderRule}-2026-04-04`,
        status: "sent",
        sentAt: new Date("2026-04-04T09:00:00.000Z"),
        queuePayload: queuePayloadJson,
        createdAt: firstCreatedAt,
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
        createdAt: secondCreatedAt,
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
    expect(
      executions.every(
        (row) =>
          row.scheduledFor.getTime() ===
          new Date("2026-04-11T09:00:00.000Z").getTime(),
      ),
    ).toBe(true);
    expect(executions[0]?.scheduledFor).not.toEqual(secondCreatedAt);

    const byId = expectDefined(await repo.getExecution(TEST_IDS.reminderExec1));
    expect(byId.scheduledFor).toEqual(new Date("2026-04-11T09:00:00.000Z"));
    expect(byId.scheduledFor).not.toEqual(firstCreatedAt);
  });

  const ESC_RULE = "a0000000-0000-4000-a000-000000000620";
  const ESC_NOW = new Date("2026-04-11T13:00:00.000Z");

  async function createEscalationRule(id: string): Promise<void> {
    await prisma.reminderRule.create({
      data: {
        id,
        policyId: ESCALATION_POLICY_ID,
        kind: "escalation",
        fireAt: new Date("2026-04-11T11:00:00.000Z"),
        deadline: expectDefined(testData.report.deadline),
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
      recipientEmail: "lead@example.test",
      errorMessage: null,
    };
  }

  it("insertExecutionOnConflict: duplicate dedupeKey inserts once and reports deduplication", async () => {
    const first = await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec1, "dup-1"),
      queuePayload,
    );
    expect(first.outcome).toBe("created");

    const second = await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec2, "dup-1"),
      queuePayload,
    );
    expect(second.outcome).toBe("deduplicated");
    // The existing row is returned, not the second caller's fresh id.
    expect(second.execution.id).toBe(TEST_IDS.reminderExec1);

    const rows = await prisma.reminderExecution.findMany({
      where: { dedupeKey: "dup-1" },
    });
    expect(rows).toHaveLength(1);
  });

  it("concurrent insertExecutionOnConflict: exactly one inserts, one row persists", async () => {
    // Races the real ON CONFLICT path under the locked editable report.
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

    expect(results.filter((r) => r.outcome === "created")).toHaveLength(1);
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
    expect(first).toEqual({
      recipientEmail: "lead@example.test",
      queuePayload,
    });
    expect(second).toBeNull();

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
    ).not.toBeNull();
    expect(
      await repo.markExecutionSent(
        TEST_IDS.reminderExec1,
        new Date("2026-04-11T09:00:05.000Z"),
      ),
    ).not.toBeNull();

    const claimed = await repo.transitionExecutionToSending(
      TEST_IDS.reminderExec1,
    );

    expect(claimed).toBeNull();
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
    expect(claimed).not.toBeNull();

    await repo.releaseExecutionClaim(TEST_IDS.reminderExec1);

    // Released back to the pre-claim status, so a retry's
    // transitionExecutionToSending can claim it again.
    const reclaimed = await repo.transitionExecutionToSending(
      TEST_IDS.reminderExec1,
    );
    expect(reclaimed).not.toBeNull();
  });

  it("releaseExecutionClaim is a no-op against an already-sent row", async () => {
    await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec1, "release-2"),
      queuePayload,
    );
    expect(
      await repo.transitionExecutionToSending(TEST_IDS.reminderExec1),
    ).not.toBeNull();
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
    ).not.toBeNull();
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

  it("terminalizes a stale sending row as unknown delivery, never fabricated sent", async () => {
    await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec1, "uncertain-1"),
      queuePayload,
    );
    expect(
      await repo.transitionExecutionToSending(TEST_IDS.reminderExec1),
    ).not.toBeNull();
    await prisma.reminderExecution.update({
      where: { id: TEST_IDS.reminderExec1 },
      data: { updatedAt: new Date("2026-04-11T09:00:00.000Z") },
    });

    await expect(
      repo.markStuckSendingUncertain(new Date("2026-04-11T09:30:00.000Z")),
    ).resolves.toBe(1);
    const uncertain = await repo.getExecution(TEST_IDS.reminderExec1);
    expect(uncertain?.status).toBe("failed");
    expect(uncertain?.errorMessage).toBe(UNCERTAIN_DELIVERY_ERROR);
  });

  it("revives a failed row with one atomic current payload write", async () => {
    await prisma.reminderExecution.create({
      data: {
        id: TEST_IDS.reminderExec1,
        ruleId: TEST_IDS.reminderRule,
        recipientEmail: "lead@test.local",
        dedupeKey: "retryable-failed",
        status: "failed",
        error: "temporary queue failure",
        queuePayload: queuePayloadJson,
      },
    });

    const result = await repo.insertExecutionOnConflict(
      baseExecution(TEST_IDS.reminderExec2, "retryable-failed"),
      queuePayload,
      true,
    );
    expect(result.outcome).toBe("revived");
    expect(result.execution.id).toBe(TEST_IDS.reminderExec1);

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

  it("rejects an execution without a renderer payload", async () => {
    await expect(
      prisma.$executeRaw(Prisma.sql`
        INSERT INTO "ReminderExecution"
          ("id", "ruleId", "recipientEmail", "dedupeKey", "status", "queuePayload", "updatedAt")
        VALUES
          (${TEST_IDS.reminderExec1}, ${TEST_IDS.reminderRule}, ${"lead@test.local"},
           ${"missing-renderer-payload"}, 'pending', NULL, CURRENT_TIMESTAMP)
      `),
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
    // Escalation ownership comes from the late lead's reporting group, even
    // when the report has no publisher yet.
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
