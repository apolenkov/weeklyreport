import type { AppSettings } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../../lib/audit-logger.js";
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

const asAny = <T>(x: unknown): T => x as T;

describe("AutoArchiverScheduler", () => {
  it("skip-when-disabled: autoArchiveWeeksAfterPublish=0 → no DB scan, no audit", async () => {
    const prisma = {
      report: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
    };
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
    const prisma = {
      report: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "rep-old-1" }, { id: "rep-old-2" }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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

    expect(result).toEqual({
      archived: true,
      periodIds: ["rep-old-1", "rep-old-2"],
    });
    expect(prisma.report.updateMany).toHaveBeenCalledTimes(2);
    // The writer flips legacy `archived` + new `periodState` + the
    // `autoArchived` audit flag in a single guarded write that re-asserts the
    // candidate predicates, so a reopen racing the scan window loses cleanly.
    expect(prisma.report.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "rep-old-1", archived: false, periodStatus: "published" },
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
  });

  it("lost-race: a candidate reopened between scan and write (updateMany count=0) is skipped — no audit, not reported archived", async () => {
    const prisma = {
      report: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "rep-reopened" }, { id: "rep-old" }]),
        updateMany: vi
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
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

    expect(result).toEqual({ archived: true, periodIds: ["rep-old"] });
    expect(audit.periodAutoArchive).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoArchive).toHaveBeenCalledWith({
      periodId: "rep-old",
      from: "published",
      to: "archived",
    });
  });

  it("excludes-reopened: candidate query filters out periodState='open' so a reopened period past its cutoff is never auto-archived", async () => {
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

    await scheduler.runOnce(new Date("2026-06-15T00:15:00Z"));

    // A reopened period keeps status='published' + archived=false + an old
    // publishedAt, so the legacy predicates alone would archive it. The
    // periodState exclusion prevents that. cutoff = now (2026-06-15T00:15Z) −
    // 4 weeks = 2026-05-18T00:15Z.
    expect(prisma.report.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.report.findMany).toHaveBeenCalledWith({
      where: {
        status: "published",
        archived: false,
        publishedAt: { lt: new Date("2026-05-18T00:15:00.000Z"), not: null },
        periodState: { not: "open" },
      },
      select: { id: true },
    });
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

    expect(result).toEqual({ archived: true, periodIds: [] });
    expect(prisma.report.updateMany).not.toHaveBeenCalled();
    expect(audit.periodAutoArchive).not.toHaveBeenCalled();
  });
});
