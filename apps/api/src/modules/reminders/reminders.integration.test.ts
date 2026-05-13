import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createTestPrisma,
  cleanDatabase,
  seedTestData,
  disconnectTestPrisma,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { RemindersPrismaRepository } from "./reminders.prisma-repository";
import { expectDefined } from "../../test-utils/expect-defined.js";

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
});
