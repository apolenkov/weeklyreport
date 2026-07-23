import type { AppSettings } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createNullAuditLogger } from "../../../lib/audit-logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";
import { PeriodCreatorScheduler } from "./period-creator.scheduler.js";

const SETTINGS: AppSettings = {
  autoCreatePeriods: false,
  defaultDeadlineDays: 4,
  periodLengthDays: 7,
  workingDays: "mon-fri",
  gracePeriodHours: 24,
  allowLateSubmissions: true,
  autoPublishAfterDeadline: false,
  autoArchiveWeeksAfterPublish: 0,
  defaultTimezone: "Europe/Moscow",
  defaultReminderAudience: "lead-with-draft",
  notificationFromEmail: null,
  deadlineTime: "18:00",
  allowReopenAfterPublish: true,
  reopenWindowHours: 72,
  unifiedActivityView: false,
};

describe("PeriodCreatorScheduler scheduled-to-open wiring (integration)", () => {
  const prisma = createTestPrisma();

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("persists the governed open transition without creating another report", async () => {
    const report = await prisma.report.create({
      data: {
        periodStart: new Date("2026-07-20T00:00:00.000Z"),
        periodEnd: new Date("2026-07-26T23:59:59.999Z"),
        deadline: new Date("2026-07-24T15:00:00.000Z"),
        periodState: "scheduled",
        status: "draft",
        archived: false,
      },
    });
    const scheduler = new PeriodCreatorScheduler(
      prisma as never,
      { getSettings: () => Promise.resolve(SETTINGS) } as never,
      createNullAuditLogger(),
    );

    const result = await scheduler.runOnce(
      new Date("2026-07-20T00:05:00.000Z"),
    );

    expect(result).toEqual({ created: false, reason: "disabled" });
    await expect(
      prisma.report.findUniqueOrThrow({ where: { id: report.id } }),
    ).resolves.toMatchObject({
      periodState: "open",
      status: "draft",
      archived: false,
      periodStatus: "open",
    });
    await expect(prisma.report.count()).resolves.toBe(1);
    await expect(prisma.reportSection.count()).resolves.toBe(0);
  });
});
