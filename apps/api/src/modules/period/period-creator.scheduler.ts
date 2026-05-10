import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AdminService } from '../admin/admin.service';
import type { AuditLogger } from '../../lib/audit-logger.js';
import { createNullAuditLogger } from '../../lib/audit-logger.js';
import { computeDeadline } from '../../lib/business-date.js';
import { getCurrentWeekBounds } from '../auth/auth.routes.js';

/**
 * UFB-049 / Phase 50-B: daily scheduler that creates the next Period when
 * the most recent one is in the past and `AppSettings.autoCreatePeriods=true`.
 *
 * Pattern mirrors {@link RemindersScheduler}: a `runOnce(now)` test seam plus
 * a thin `@Cron` wrapper that supplies `new Date()`. We chose `@Cron` over
 * BullMQ repeatable jobs because (a) the workload is one DB write per day —
 * far below the queue/retry/DLQ threshold; (b) the codebase already has the
 * `@Cron` idiom (`RemindersScheduler`); (c) `@nestjs/bullmq` 11 has a
 * documented DiscoveryService DI bug under NestJS 11 that the existing
 * processors explicitly work around with raw `Worker`.
 *
 * Idempotency: the scheduler skips when a future Period (periodEnd > now)
 * already exists, so two ticks within the same day collapse to a single
 * Period without DB constraint races.
 *
 * Cron: fires daily at 00:05 (UTC for now; per-tz Cron is deferred to
 * Phase 51-A which broadens the settings surface). The 5-minute offset
 * avoids midnight crowding with backup/maintenance jobs.
 */
@Injectable()
export class PeriodCreatorScheduler {
  private readonly logger = new Logger(PeriodCreatorScheduler.name);
  private readonly auditLogger: AuditLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
    auditLogger?: AuditLogger,
  ) {
    this.auditLogger = auditLogger ?? createNullAuditLogger();
  }

  // Every day at 00:05 UTC. The 5-minute offset keeps the tick out of the
  // 00:00 backup window most ops shops run on.
  @Cron('5 0 * * *')
  async runDaily(): Promise<void> {
    await this.runOnce(new Date());
  }

  /**
   * Scheduler-internal entry point exposed for unit tests so we can drive
   * the tick deterministically with a stubbed `now`. Returns a small
   * outcome object so tests don't have to scrape audit calls.
   */
  async runOnce(
    now: Date,
  ): Promise<
    | { created: false; reason: 'disabled' | 'future-period-exists' }
    | {
        created: true;
        periodId: string;
        periodStart: Date;
        periodEnd: Date;
        deadline: Date;
      }
  > {
    const settings = await this.adminService.getSettings();
    if (!settings.autoCreatePeriods) {
      return { created: false, reason: 'disabled' };
    }

    // Most recent period across the whole table. If it ends in the future
    // (or right now), nothing to do — the current cycle is still open.
    const mostRecent = await this.prisma.report.findFirst({
      orderBy: { periodStart: 'desc' },
      select: { id: true, periodEnd: true },
    });

    if (mostRecent && mostRecent.periodEnd.getTime() > now.getTime()) {
      return { created: false, reason: 'future-period-exists' };
    }

    // Anchor the next period to "next Monday" (or current week's Monday if
    // we are still inside it — defensive against a no-period DB).
    const { periodStart, periodEnd } = getCurrentWeekBounds(
      mostRecent
        ? new Date(mostRecent.periodEnd.getTime() + 24 * 3_600_000)
        : now,
      settings.periodLengthDays,
    );

    const deadline = computeDeadline(
      periodStart,
      settings.defaultDeadlineDays,
      settings.workingDays,
      settings.defaultTimezone,
      18,
    );

    const created = await this.prisma.report.create({
      data: { periodStart, periodEnd, deadline },
      select: { id: true, periodStart: true, periodEnd: true, deadline: true },
    });

    this.logger.log(
      `auto-create period=${created.id} (${created.periodStart.toISOString()} → ${created.periodEnd.toISOString()})`,
    );
    this.auditLogger.periodAutoCreate({
      periodId: created.id,
      periodStart: created.periodStart.toISOString(),
      periodEnd: created.periodEnd.toISOString(),
      deadline: created.deadline.toISOString(),
    });

    return {
      created: true,
      periodId: created.id,
      periodStart: created.periodStart,
      periodEnd: created.periodEnd,
      deadline: created.deadline,
    };
  }
}
