import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AdminService } from '../admin/admin.service';
import type { AuditLogger } from '../../lib/audit-logger.js';
import { createNullAuditLogger } from '../../lib/audit-logger.js';

/**
 * UFB-049 / Phase 50-B: daily scheduler that flips published Reports to
 * `archived=true` once their `publishedAt + autoArchiveWeeksAfterPublish *
 * 7d` cutoff has passed.
 *
 * Skips entirely when `autoArchiveWeeksAfterPublish === 0` — the admin's
 * way of saying "never auto-archive". This is the opt-IN default; the
 * Phase 50-A schema default of 0 keeps existing orgs on the manual-archive
 * path until they flip the toggle.
 *
 * Idempotency: the where-clause already excludes `archived=true` rows, so
 * a tick that runs twice on the same day is a no-op on the second pass.
 *
 * Cron: fires daily at 00:15 UTC. The 10-minute offset from the
 * period-creator (00:05) avoids two transactions competing for the same
 * advisory locks at midnight.
 */
@Injectable()
export class AutoArchiverScheduler {
  private readonly logger = new Logger(AutoArchiverScheduler.name);
  private readonly auditLogger: AuditLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
    auditLogger?: AuditLogger,
  ) {
    this.auditLogger = auditLogger ?? createNullAuditLogger();
  }

  // Every day at 00:15 UTC.
  @Cron('15 0 * * *')
  async runDaily(): Promise<void> {
    await this.runOnce(new Date());
  }

  /**
   * Test seam. Returns the list of archived periodIds so unit tests can
   * assert "fires when eligible" / "skips when disabled" without scraping
   * audit calls.
   */
  async runOnce(
    now: Date,
  ): Promise<
    | { archived: false; reason: 'disabled' }
    | { archived: true; periodIds: ReadonlyArray<string> }
  > {
    const settings = await this.adminService.getSettings();
    if (settings.autoArchiveWeeksAfterPublish <= 0) {
      return { archived: false, reason: 'disabled' };
    }

    const weeksMs =
      settings.autoArchiveWeeksAfterPublish * 7 * 24 * 3_600_000;
    const cutoff = new Date(now.getTime() - weeksMs);

    const candidates = await this.prisma.report.findMany({
      where: {
        status: 'published',
        archived: false,
        publishedAt: { lt: cutoff, not: null },
      },
      select: { id: true },
    });

    if (candidates.length === 0) {
      return { archived: true, periodIds: [] };
    }

    const archivedIds: string[] = [];
    for (const candidate of candidates) {
      try {
        // UFB-053 / Phase 51-C: write the legacy `archived` boolean AND
        // the new `periodState` column AND the 51-A `autoArchived` audit
        // flag in a single update. Order matters only for downstream
        // readers; this is atomic at the row level.
        await this.prisma.report.update({
          where: { id: candidate.id },
          data: {
            archived: true,
            periodState: 'archived',
            autoArchived: true,
          },
        });
        this.logger.log(`auto-archive period=${candidate.id}`);
        this.auditLogger.periodAutoArchive({
          periodId: candidate.id,
          from: 'published',
          to: 'archived',
        });
        archivedIds.push(candidate.id);
      } catch (err) {
        this.logger.error(
          `auto-archive failed period=${candidate.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { archived: true, periodIds: archivedIds };
  }
}
