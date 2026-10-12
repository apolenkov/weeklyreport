import type {
  AdminReminderExecution,
  PaginatedResult,
} from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createNullLogger } from "../../lib/logger";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper.js";
import { RemindersPrismaRepository } from "./reminders.prisma-repository.js";
import { RemindersService } from "./reminders.service.js";

const EXECUTION_COUNT = 105;
const PAGE_SIZE = 20;
const RULE_ID = "a0000000-0000-4000-a000-000000000700";
const POLICY_ID = "a0000000-0000-4000-a000-000000000705";
const CREATED_AT = new Date("2026-04-11T09:00:00.000Z");
const QUEUE_PAYLOAD = {
  contractVersion: 1 as const,
  kind: "deadline" as const,
  cycleDate: "2026-04-11",
  leadName: "Test Lead",
  reportPeriod: "2026-04-06 → 2026-04-12",
  deadlineIso: "2026-04-11T00:00:00.000Z",
  sectionUrl: "https://example.test/lead/report",
  organization: {
    shortName: "WeeklyReport",
    fullName: "WeeklyReport Department",
  },
};

const prisma = createTestPrisma();
const repository = new RemindersPrismaRepository(prisma as never);
const service = new RemindersService(repository, createNullLogger());

async function seedExecutionHistory(): Promise<readonly string[]> {
  const { report } = await seedTestData(prisma);
  await prisma.reminderPolicy.create({
    data: {
      id: POLICY_ID,
      kind: "deadline",
      offsetMinutes: -1440,
      timezone: "Europe/Moscow",
      audience: "LEAD_WITH_DRAFT",
      active: true,
    },
  });
  await prisma.reminderRule.create({
    data: {
      id: RULE_ID,
      policyId: POLICY_ID,
      kind: "deadline",
      fireAt: CREATED_AT,
      deadline: new Date(QUEUE_PAYLOAD.deadlineIso),
      timezone: "Europe/Moscow",
      status: "active",
      version: 1,
      reportId: report.id,
    },
  });

  const executionIds = Array.from({ length: EXECUTION_COUNT }, () =>
    crypto.randomUUID(),
  );
  await prisma.reminderExecution.createMany({
    data: executionIds.map((id, index) => ({
      id,
      ruleId: RULE_ID,
      recipientEmail: `lead-${index}@test.local`,
      dedupeKey: `${RULE_ID}:deadline:2026-04-11:lead-${index}@test.local`,
      status: "pending",
      queuePayload: QUEUE_PAYLOAD,
      createdAt: new Date(CREATED_AT.getTime() - index),
    })),
  });
  return executionIds;
}

async function collectPages(
  cursor?: string,
): Promise<PaginatedResult<AdminReminderExecution>[]> {
  const page = await service.listExecutions(RULE_ID, {
    limit: PAGE_SIZE,
    ...(cursor ? { cursor } : {}),
  });
  return page.nextCursor
    ? [page, ...(await collectPages(page.nextCursor))]
    : [page];
}

describe("RemindersPrismaRepository execution pagination", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("walks every execution after a rule has accumulated more than 100", async () => {
    const executionIds = await seedExecutionHistory();
    const pages = await collectPages();
    const returnedIds = pages.flatMap((page) =>
      page.items.map((execution) => execution.id),
    );

    expect(pages).toHaveLength(Math.ceil(EXECUTION_COUNT / PAGE_SIZE));
    expect(pages.slice(0, -1).every((page) => page.nextCursor !== null)).toBe(
      true,
    );
    expect(pages.at(-1)?.nextCursor).toBeNull();
    expect(returnedIds).toHaveLength(EXECUTION_COUNT);
    expect(new Set(returnedIds)).toEqual(new Set(executionIds));
  });
});
