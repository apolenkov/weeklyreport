import { describe, expect, it, vi } from 'vitest';

import type { AppSettings } from '@customreport/shared';

import { PeriodCreatorScheduler } from './period-creator.scheduler.js';
import { createNullAuditLogger } from '../../lib/audit-logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    autoCreatePeriods: true,
    defaultDeadlineDays: 4,
    periodLengthDays: 7,
    workingDays: 'mon-fri',
    gracePeriodHours: 24,
    allowLateSubmissions: true,
    autoPublishAfterDeadline: false,
    autoArchiveWeeksAfterPublish: 0,
    defaultTimezone: 'Europe/Moscow',
    defaultReminderAudience: 'lead-with-draft',
    notificationFromEmail: null,
    // UFB-051 (Phase 51-A): period-cycle knobs default to SQL defaults.
    // The cadence-aware PeriodCreator (bi-weekly, maxOpenPeriods gate)
    // arrives in 51-C — 51-A keeps the scheduler reading the legacy
    // `periodLengthDays`/`defaultDeadlineDays` path.
    firstDayOfWeek: 1,
    deadlineDayOfWeek: 5,
    deadlineTime: '18:00',
    periodCadence: 'weekly',
    maxOpenPeriods: 1,
    requireAllSectionsToPublish: true,
    allowReopenAfterPublish: true,
    reopenWindowHours: 72,
    ...overrides,
  };
}

type StubPrisma = {
  report: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

function makePrismaStub(opts: {
  mostRecent: { id: string; periodEnd: Date } | null;
  createdId?: string;
}): StubPrisma {
  return {
    report: {
      findFirst: vi.fn().mockResolvedValue(opts.mostRecent),
      create: vi.fn().mockImplementation(async ({ data }) => ({
        id: opts.createdId ?? 'period-new',
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        deadline: data.deadline,
      })),
    },
  };
}

// Cast to never via Nest DI seam — the scheduler types its constructor on
// PrismaService + AdminService; tests pass a minimal shape with only the
// methods exercised.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAny = (x: unknown) => x as any;

// ---------------------------------------------------------------------------
// Tests — three per processor (skip-when-disabled, fire-when-eligible,
// idempotent)
// ---------------------------------------------------------------------------

describe('PeriodCreatorScheduler', () => {
  it('skip-when-disabled: autoCreatePeriods=false → no create, no audit', async () => {
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

    const result = await scheduler.runOnce(new Date('2026-05-12T00:05:00Z'));

    expect(result).toEqual({ created: false, reason: 'disabled' });
    expect(prisma.report.findFirst).not.toHaveBeenCalled();
    expect(prisma.report.create).not.toHaveBeenCalled();
  });

  it('fire-when-eligible: prev period ended in the past → creates new Period + emits audit', async () => {
    // Previous period ended last Sunday; today is Monday → create next period.
    const prisma = makePrismaStub({
      mostRecent: {
        id: 'period-old',
        periodEnd: new Date('2026-05-10T23:59:59.999Z'),
      },
      createdId: 'period-new-1',
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

    const result = await scheduler.runOnce(new Date('2026-05-12T00:05:00Z'));

    expect(result).toMatchObject({ created: true, periodId: 'period-new-1' });
    expect(prisma.report.create).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoCreate).toHaveBeenCalledTimes(1);
    expect(audit.periodAutoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ periodId: 'period-new-1' }),
    );
  });

  it('idempotent: future period already exists → skip, no create, no audit', async () => {
    const prisma = makePrismaStub({
      mostRecent: {
        id: 'period-current',
        periodEnd: new Date('2026-05-17T23:59:59.999Z'), // ends in the future
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

    const result = await scheduler.runOnce(new Date('2026-05-12T00:05:00Z'));

    expect(result).toEqual({
      created: false,
      reason: 'future-period-exists',
    });
    expect(prisma.report.create).not.toHaveBeenCalled();
    expect(audit.periodAutoCreate).not.toHaveBeenCalled();
  });
});
