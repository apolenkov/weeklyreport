import { describe, expect, it, vi } from "vitest";
import { silenceNestLogger } from "../../test-utils/silence-logs";

import type { AppSettings } from "@customreport/shared";

import { AutoPublisherScheduler } from "./auto-publisher.scheduler.js";
import { createNullAuditLogger } from "../../lib/audit-logger.js";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAny = (x: unknown) => x as any;

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
        // UFB-053: state-machine write happens after publishAuto succeeds.
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
    // UFB-053: explicit state-machine write to periodState='published' +
    // 51-A autoPublished flag.
    expect(prisma.report.update).toHaveBeenCalledWith({
      where: { id: "rep-1" },
      data: { periodState: "published", autoPublished: true },
    });
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
        // UFB-053: state write only for the succeeding row.
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
        .mockImplementationOnce(async () => {
          throw new Error("db transient");
        })
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
    // UFB-053: state-machine write only fires for the succeeding row.
    expect(prisma.report.update).toHaveBeenCalledTimes(1);
    expect(prisma.report.update).toHaveBeenCalledWith({
      where: { id: "rep-good" },
      data: { periodState: "published", autoPublished: true },
    });
  });
});
