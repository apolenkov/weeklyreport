import type { AppSettings } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";
import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { silenceNestLogger } from "../../test-utils/silence-logs";
import { AutoPublisherScheduler } from "./auto-publisher.scheduler.js";

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    autoCreatePeriods: false,
    defaultDeadlineDays: 4,
    periodLengthDays: 7,
    workingDays: "mon-fri",
    gracePeriodHours: 2,
    allowLateSubmissions: true,
    autoPublishAfterDeadline: true,
    autoArchiveWeeksAfterPublish: 0,
    defaultTimezone: "Europe/Moscow",
    defaultReminderAudience: "lead-with-draft",
    notificationFromEmail: null,
    // UFB-051 (Phase 51-A): period-cycle knobs default to SQL defaults.
    // 51-A is persistence-only; the scheduler does not yet read these.
    firstDayOfWeek: 1,
    deadlineDayOfWeek: 5,
    deadlineTime: "18:00",
    maxOpenPeriods: 1,
    requireAllSectionsToPublish: true,
    allowReopenAfterPublish: true,
    reopenWindowHours: 72,
    ...overrides,
  };
}

const asAny = <T>(x: unknown): T => x as T;

describe("AutoPublisherScheduler", () => {
  it("skip-when-disabled: autoPublishAfterDeadline=false → no DB scan", async () => {
    const prisma = {
      report: { findMany: vi.fn() },
      reportSection: { count: vi.fn() },
    };
    const admin = {
      getSettings: vi
        .fn()
        .mockResolvedValue(makeSettings({ autoPublishAfterDeadline: false })),
    };
    const publication = { publishAuto: vi.fn() };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({ published: false, reason: "disabled" });
    expect(prisma.report.findMany).not.toHaveBeenCalled();
    expect(publication.publishAuto).not.toHaveBeenCalled();
    expect(audit.periodAutoPublish).not.toHaveBeenCalled();
  });

  it("fire-when-eligible: draft past deadline+grace → publishAuto + emits audit with missingSectionsCount", async () => {
    const prisma = {
      report: {
        findMany: vi.fn().mockResolvedValue([{ id: "rep-1" }]),
        // refactor-period-transition-writer: the scheduler no longer writes
        // lifecycle fields itself — publishAuto owns the complete atomic write.
        update: vi.fn().mockResolvedValue({}),
      },
      reportSection: { count: vi.fn().mockResolvedValue(2) },
    };
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const publication = { publishAuto: vi.fn().mockResolvedValue({}) };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({ published: true, periodIds: ["rep-1"] });
    expect(publication.publishAuto).toHaveBeenCalledWith("rep-1");
    // refactor-period-transition-writer: the lifecycle write is now owned by
    // publishAuto (atomic, via the transition builder). The scheduler must NOT
    // issue its own report.update — that second round-trip was the torn-write
    // bug this change closes.
    expect(prisma.report.update).not.toHaveBeenCalled();
    expect(audit.periodAutoPublish).toHaveBeenCalledWith({
      periodId: "rep-1",
      missingSectionsCount: 2,
      from: "open",
      to: "published",
    });
  });

  it("idempotent: no eligible drafts → no-op, no publishAuto, no audit", async () => {
    const prisma = {
      report: { findMany: vi.fn().mockResolvedValue([]) },
      reportSection: { count: vi.fn() },
    };
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const publication = { publishAuto: vi.fn() };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({ published: true, periodIds: [] });
    expect(publication.publishAuto).not.toHaveBeenCalled();
    expect(audit.periodAutoPublish).not.toHaveBeenCalled();
  });

  it("single-period failure does not abort the tick (one bad report ≠ blocked queue)", async () => {
    silenceNestLogger();
    const prisma = {
      report: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "rep-bad" }, { id: "rep-good" }]),
        // refactor-period-transition-writer: scheduler issues no lifecycle
        // write of its own; publishAuto owns it.
        update: vi.fn().mockResolvedValue({}),
      },
      reportSection: { count: vi.fn().mockResolvedValue(0) },
    };
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const publication = {
      publishAuto: vi
        .fn()
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async publishAuto contract (throws synchronously to simulate error)
        .mockImplementationOnce(async () => {
          throw new Error("db transient");
        })
        // eslint-disable-next-line @typescript-eslint/require-await -- mock implements async publishAuto contract (no awaitable work in the stub)
        .mockImplementationOnce(async () => ({})),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoPublish: vi.fn(),
    };

    const scheduler = new AutoPublisherScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(publication),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T12:00:00Z"));

    expect(result).toEqual({ published: true, periodIds: ["rep-good"] });
    expect(audit.periodAutoPublish).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoPublish).toHaveBeenCalledWith({
      periodId: "rep-good",
      missingSectionsCount: 0,
      from: "open",
      to: "published",
    });
    // refactor-period-transition-writer: no scheduler-issued lifecycle write,
    // for the succeeding row or otherwise — publishAuto owns it atomically.
    expect(prisma.report.update).not.toHaveBeenCalled();
  });
});
