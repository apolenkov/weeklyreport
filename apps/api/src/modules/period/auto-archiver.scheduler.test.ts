import { describe, expect, it, vi } from 'vitest';

import type { AppSettings } from '@customreport/shared';

import { AutoArchiverScheduler } from './auto-archiver.scheduler.js';
import { createNullAuditLogger } from '../../lib/audit-logger.js';

function makeSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    autoCreatePeriods: false,
    defaultDeadlineDays: 4,
    periodLengthDays: 7,
    workingDays: 'mon-fri',
    gracePeriodHours: 24,
    allowLateSubmissions: true,
    autoPublishAfterDeadline: false,
    autoArchiveWeeksAfterPublish: 4,
    defaultTimezone: 'Europe/Moscow',
    defaultReminderAudience: 'lead-with-draft',
    notificationFromEmail: null,
    // UFB-051 (Phase 51-A): period-cycle knobs default to SQL defaults.
    // The AutoArchiver does not yet stamp `Report.autoArchived` — that
    // consumer arrives in 51-C alongside the state-machine dashboard.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAny = (x: unknown) => x as any;

describe('AutoArchiverScheduler', () => {
  it('skip-when-disabled: autoArchiveWeeksAfterPublish=0 → no DB scan, no audit', async () => {
    const prisma = {
      report: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
    const admin = {
      getSettings: vi
        .fn()
        .mockResolvedValue(
          makeSettings({ autoArchiveWeeksAfterPublish: 0 }),
        ),
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

    const result = await scheduler.runOnce(new Date('2026-06-15T00:15:00Z'));

    expect(result).toEqual({ archived: false, reason: 'disabled' });
    expect(prisma.report.findMany).not.toHaveBeenCalled();
    expect(audit.periodAutoArchive).not.toHaveBeenCalled();
  });

  it('fire-when-eligible: published >N weeks ago + archived=false → flips archived=true + emits audit', async () => {
    const prisma = {
      report: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'rep-old-1' }, { id: 'rep-old-2' }]),
        update: vi.fn().mockResolvedValue({}),
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

    const result = await scheduler.runOnce(new Date('2026-06-15T00:15:00Z'));

    expect(result).toEqual({
      archived: true,
      periodIds: ['rep-old-1', 'rep-old-2'],
    });
    expect(prisma.report.update).toHaveBeenCalledTimes(2);
    expect(prisma.report.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'rep-old-1' },
      data: { archived: true },
    });
    expect(audit.periodAutoArchive).toHaveBeenCalledTimes(2);
  });

  it('idempotent: candidate set empty (all rows already archived) → no update, no audit', async () => {
    const prisma = {
      report: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
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

    const result = await scheduler.runOnce(new Date('2026-06-15T00:15:00Z'));

    expect(result).toEqual({ archived: true, periodIds: [] });
    expect(prisma.report.update).not.toHaveBeenCalled();
    expect(audit.periodAutoArchive).not.toHaveBeenCalled();
  });
});
