import type { AppSettings } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { createNullAuditLogger } from "../../lib/audit-logger.js";
import { PeriodCreatorScheduler } from "./period-creator.scheduler.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    autoCreatePeriods: true,
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
    // UFB-051 (Phase 51-A): period-cycle knobs default to SQL defaults.
    // The cadence-aware PeriodCreator (bi-weekly, maxOpenPeriods gate)
    // arrives in 51-C — 51-A keeps the scheduler reading the legacy
    // `periodLengthDays`/`defaultDeadlineDays` path.
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

interface ReportCreateData {
  periodStart: Date;
  periodEnd: Date;
  deadline: Date;
  periodState: "scheduled" | "open";
}

interface StubPrisma {
  report: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    // UFB-053: updateMany used by the SCHEDULED→OPEN sweep at the top of
    // each tick.
    updateMany: ReturnType<typeof vi.fn>;
  };
}

function makePrismaStub(opts: {
  mostRecent: { id: string; periodEnd: Date } | null;
  createdId?: string;
  // count returned by the SCHEDULED→OPEN updateMany sweep.
  scheduledFlipped?: number;
}): StubPrisma {
  return {
    report: {
      findFirst: vi.fn().mockResolvedValue(opts.mostRecent),
      // The scheduler `await`s create(); a plain object resolves the same, so the
      // stub stays sync (no `async` → no require-await disable to keep in place).
      create: vi
        .fn()
        .mockImplementation(({ data }: { data: ReportCreateData }) => ({
          id: opts.createdId ?? "period-new",
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          deadline: data.deadline,
          // UFB-053: echo the periodState the scheduler wrote so the
          // returned shape matches the real prisma client surface.
          periodState: data.periodState,
        })),
      updateMany: vi
        .fn()
        .mockResolvedValue({ count: opts.scheduledFlipped ?? 0 }),
    },
  };
}

// Cast to never via Nest DI seam — the scheduler types its constructor on
// PrismaService + AdminService; tests pass a minimal shape with only the
// methods exercised.
const asAny = <T>(x: unknown): T => x as T;

// ---------------------------------------------------------------------------
// Tests — three per processor (skip-when-disabled, fire-when-eligible,
// idempotent)
// ---------------------------------------------------------------------------

describe("PeriodCreatorScheduler", () => {
  it("skip-when-disabled: autoCreatePeriods=false → no create, no audit", async () => {
    const prisma = makePrismaStub({ mostRecent: null });
    const admin = {
      getSettings: vi
        .fn()
        .mockResolvedValue(makeSettings({ autoCreatePeriods: false })),
    };
    const audit = createNullAuditLogger();
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
      audit,
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toEqual({ created: false, reason: "disabled" });
    expect(prisma.report.findFirst).not.toHaveBeenCalled();
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it("fire-when-eligible: prev period ended in the past → creates new Period + emits audit", async () => {
    // Previous period ended last Sunday; today is Monday → create next period.
    const prisma = makePrismaStub({
      mostRecent: {
        id: "period-old",
        periodEnd: new Date("2026-05-10T23:59:59.999Z"),
      },
      createdId: "period-new-1",
    });
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoCreate: vi.fn(),
    };
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toMatchObject({ created: true, periodId: "period-new-1" });
    expect(prisma.report.create).toHaveBeenCalledTimes(1);
    // UFB-053: state column written on create; here periodStart is "this
    // week's Monday" which is <= now, so the period lands as 'open'.
    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining() returns any; vitest asymmetric matcher has no precise type
        data: expect.objectContaining({ periodState: "open" }),
      }),
    );
    expect(audit.periodAutoCreate).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        periodId: "period-new-1",
        from: null,
        to: "open",
      }),
    );
  });

  it("UFB-053: SCHEDULED→OPEN sweep flips any past-due scheduled rows at top of tick", async () => {
    const prisma = makePrismaStub({
      mostRecent: {
        id: "period-future",
        // The most-recent period ends in the future, so no create happens.
        // The sweep still runs first.
        periodEnd: new Date("2026-05-30T23:59:59.999Z"),
      },
      scheduledFlipped: 2,
    });
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoCreate: vi.fn(),
    };
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(prisma.report.updateMany).toHaveBeenCalledWith({
      where: {
        periodState: "scheduled",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() returns any; vitest asymmetric matcher has no precise type
        periodStart: { lte: expect.any(Date) },
      },
      // refactor-period-transition-writer: the open transition writes the full
      // field set (periodState + the draft/false legacy tuple already on the
      // scheduled rows).
      data: { periodState: "open", status: "draft", archived: false },
    });
  });

  it("TD-06: policyApplicator.applyToPeriod called once when period is created", async () => {
    const prisma = makePrismaStub({
      mostRecent: {
        id: "period-old",
        periodEnd: new Date("2026-05-10T23:59:59.999Z"),
      },
      createdId: "period-td06",
    });
    const admin = { getSettings: vi.fn().mockResolvedValue(makeSettings()) };
    const policyApplicator = {
      applyToPeriod: vi.fn().mockResolvedValue(undefined),
    };
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
      undefined,
      asAny(policyApplicator),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toMatchObject({ created: true, periodId: "period-td06" });
    expect(policyApplicator.applyToPeriod).toHaveBeenCalledTimes(1);
    expect(policyApplicator.applyToPeriod).toHaveBeenCalledWith(
      expect.objectContaining({ id: "period-td06" }),
    );
  });

  it("idempotent: future period already exists → skip, no create, no audit", async () => {
    const prisma = makePrismaStub({
      mostRecent: {
        id: "period-current",
        periodEnd: new Date("2026-05-17T23:59:59.999Z"), // ends in the future
      },
    });
    const admin = {
      getSettings: vi.fn().mockResolvedValue(makeSettings()),
    };
    const audit = {
      ...createNullAuditLogger(),
      periodAutoCreate: vi.fn(),
    };
    const scheduler = new PeriodCreatorScheduler(
      asAny(prisma),
      asAny(admin),
      asAny(audit),
    );

    const result = await scheduler.runOnce(new Date("2026-05-12T00:05:00Z"));

    expect(result).toEqual({
      created: false,
      reason: "future-period-exists",
    });
    expect(prisma.report.create).not.toHaveBeenCalled();
    expect(audit.periodAutoCreate).not.toHaveBeenCalled();
  });
});
