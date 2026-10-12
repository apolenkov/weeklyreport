import type { AppSettings } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../../test-utils/audit-logger.js";
import { AutoArchiverScheduler } from "./auto-archiver.scheduler.js";

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    autoCreatePeriods: false,
    defaultDeadlineDays: 4,
    periodLengthDays: 7,
    workingDays: "mon-fri",
    gracePeriodHours: 24,
    allowLateSubmissions: true,
    autoPublishAfterDeadline: false,
    autoArchiveWeeksAfterPublish: 4,
    defaultTimezone: "Europe/Moscow",
    defaultReminderAudience: "lead-with-draft",
    notificationFromEmail: null,
    // period-cycle knobs at SQL defaults.
    deadlineTime: "18:00",
    allowReopenAfterPublish: true,
    reopenWindowHours: 72,
    unifiedActivityView: false,
    ...overrides,
  };
}

const asAny = (value: unknown): never => value as never;

function withReminderTransaction<
  T extends { report: { updateMany: ReturnType<typeof vi.fn> } },
>(prisma: T) {
  const reminderRule = {
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    report: prisma.report,
    reminderRule,
  };
  return Object.assign(prisma, {
    reminderRule,
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  });
}

describe("AutoArchiverScheduler", () => {
  it("skip-when-disabled: autoArchiveWeeksAfterPublish=0 → no DB scan, no audit", async () => {
    const prisma = withReminderTransaction({
      report: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
    });
    const admin = {
      getSettings: vi
        .fn()
        .mockResolvedValue(makeSettings({ autoArchiveWeeksAfterPublish: 0 })),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoArchive: vi.fn(),
    };

    const scheduler = new AutoArchiverScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-06-15T00:15:00Z"));

    expect(result).toEqual({ archived: false, reason: "disabled" });
    expect(prisma.report.findMany).not.toHaveBeenCalled();
    expect(audit.periodAutoArchive).not.toHaveBeenCalled();
  });

  it("fire-when-eligible: published >N weeks ago + archived=false → flips archived=true + emits audit", async () => {
    const prisma = withReminderTransaction({
      report: {
        findMany: vi.fn().mockResolvedValue([
          { id: "rep-old-1", publishedAt: new Date("2026-05-01T00:00:00Z") },
          { id: "rep-old-2", publishedAt: new Date("2026-05-02T00:00:00Z") },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    });
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoArchive: vi.fn(),
    };

    const scheduler = new AutoArchiverScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-06-15T00:15:00Z"));

    expect(result).toEqual({
      archived: true,
      periodIds: ["rep-old-1", "rep-old-2"],
      failures: [],
    });
    expect(prisma.report.updateMany).toHaveBeenCalledTimes(2);
    // The writer flips `archived` + `periodState` + the
    // `autoArchived` audit flag in a single guarded write that re-asserts the
    // candidate predicates, so a reopen racing the scan window loses cleanly.
    expect(prisma.report.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "rep-old-1",
        archived: false,
        periodStatus: "published",
        publishedAt: new Date("2026-05-01T00:00:00.000Z"),
      },
      data: {
        archived: true,
        periodState: "archived",
        autoArchived: true,
      },
    });
    expect(audit.periodAutoArchive).toHaveBeenCalledTimes(2);
    expect(audit.periodAutoArchive).toHaveBeenNthCalledWith(1, {
      periodId: "rep-old-1",
      from: "published",
      to: "archived",
    });
    expect(prisma.reminderRule.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.reminderRule.updateMany).toHaveBeenNthCalledWith(1, {
      where: { reportId: "rep-old-1", status: "active" },
      data: { status: "paused" },
    });
  });

  it("lost-race: a candidate reopened between scan and write (updateMany count=0) is skipped — no audit, not reported archived", async () => {
    const prisma = withReminderTransaction({
      report: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "rep-reopened",
            publishedAt: new Date("2026-05-01T00:00:00Z"),
          },
          { id: "rep-old", publishedAt: new Date("2026-05-02T00:00:00Z") },
        ]),
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
      },
    });
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoArchive: vi.fn(),
    };

    const scheduler = new AutoArchiverScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-06-15T00:15:00Z"));

    expect(result).toEqual({
      archived: true,
      periodIds: ["rep-old"],
      failures: [],
    });
    expect(audit.periodAutoArchive).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoArchive).toHaveBeenCalledWith({
      periodId: "rep-old",
      from: "published",
      to: "archived",
    });
    expect(prisma.reminderRule.updateMany).toHaveBeenCalledOnce();
    expect(prisma.reminderRule.updateMany).toHaveBeenCalledWith({
      where: { reportId: "rep-old", status: "active" },
      data: { status: "paused" },
    });
  });

  it("excludes-reopened: candidate query filters out periodState='open' so a reopened period past its cutoff is never auto-archived", async () => {
    const prisma = withReminderTransaction({
      report: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
    });
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoArchive: vi.fn(),
    };

    const scheduler = new AutoArchiverScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    await scheduler.runOnce(new Date("2026-06-15T00:15:00Z"));

    // A reopened period keeps status='published' + archived=false + an old
    // publishedAt, so the companion predicates alone would archive it. The
    // periodState exclusion prevents that.
    expect(prisma.report.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.report.findMany).toHaveBeenCalledWith({
      where: {
        status: "published",
        archived: false,
        publishedAt: { lt: new Date("2026-05-18T00:15:00.000Z"), not: null },
        periodState: { not: "open" },
      },
      select: { id: true, publishedAt: true },
    });
  });

  it("does not archive a fresh republish after the scan (ABA interleaving)", async () => {
    const selectedPublishedAt = new Date("2026-05-01T00:00:00Z");
    const republishedAt = new Date("2026-06-14T12:00:00Z");
    let currentPublishedAt = selectedPublishedAt;
    const prisma = withReminderTransaction({
      report: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "rep-republished", publishedAt: selectedPublishedAt },
          ]),
        updateMany: vi
          .fn()
          .mockImplementation((args: { where: { publishedAt: Date } }) => {
            const { where } = args;
            // Model the interleaving between candidate selection and the CAS:
            // the report is reopened and published again with the same id.
            currentPublishedAt = republishedAt;
            return {
              count:
                where.publishedAt.getTime() === currentPublishedAt.getTime()
                  ? 1
                  : 0,
            };
          }),
      },
    });
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoArchive: vi.fn(),
    };

    const scheduler = new AutoArchiverScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-06-15T00:15:00Z"));

    expect(result).toEqual({
      archived: true,
      periodIds: [],
      failures: [],
    });
    expect(prisma.report.updateMany).toHaveBeenCalledWith({
      where: {
        id: "rep-republished",
        archived: false,
        periodStatus: "published",
        publishedAt: selectedPublishedAt,
      },
      data: {
        archived: true,
        periodState: "archived",
        autoArchived: true,
      },
    });
    expect(audit.periodAutoArchive).not.toHaveBeenCalled();
    expect(currentPublishedAt).toBe(republishedAt);
  });

  it("idempotent: candidate set empty (all rows already archived) → no update, no audit", async () => {
    const prisma = {
      report: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
    };
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoArchive: vi.fn(),
    };

    const scheduler = new AutoArchiverScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-06-15T00:15:00Z"));

    expect(result).toEqual({ archived: true, periodIds: [], failures: [] });
    expect(prisma.report.updateMany).not.toHaveBeenCalled();
    expect(audit.periodAutoArchive).not.toHaveBeenCalled();
  });

  it("reports per-row failures: a throwing write is surfaced, the remaining rows still archive", async () => {
    const prisma = withReminderTransaction({
      report: {
        findMany: vi.fn().mockResolvedValue([
          { id: "rep-boom", publishedAt: new Date("2026-05-01T00:00:00Z") },
          { id: "rep-ok", publishedAt: new Date("2026-05-02T00:00:00Z") },
        ]),
        updateMany: vi
          .fn()
          .mockRejectedValueOnce(new Error("db transient"))
          .mockResolvedValueOnce({ count: 1 }),
      },
    });
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoArchive: vi.fn(),
    };

    const scheduler = new AutoArchiverScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-06-15T00:15:00Z"));

    // A real write error must be visible on the tick result, not folded into
    // a bare `{ archived: true }` with no signal that a row was lost.
    expect(result).toEqual({
      archived: true,
      periodIds: ["rep-ok"],
      failures: [{ periodId: "rep-boom", error: "db transient" }],
    });
    expect(audit.periodAutoArchive).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoArchive).toHaveBeenCalledWith({
      periodId: "rep-ok",
      from: "published",
      to: "archived",
    });
  });
});
