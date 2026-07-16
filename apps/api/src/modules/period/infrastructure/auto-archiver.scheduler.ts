import { MS_PER_WEEK } from "@customreport/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { AuditLogger } from "../../../lib/audit-logger.js";
import { SnapshotAdminService } from "../../admin/index.js";
import { buildTransition } from "../domain/period-transition.js";

/**
 * Daily scheduler that flips published Reports to `archived=true` once their
 * `publishedAt + autoArchiveWeeksAfterPublish * 7d` cutoff has passed.
 *
 * Skips entirely when `autoArchiveWeeksAfterPublish === 0` — the admin's
 * way of saying "never auto-archive". This is the opt-IN default; the schema
 * default of 0 keeps existing orgs on the manual-archive path until they flip
 * the toggle.
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotAdminService: SnapshotAdminService,
    private readonly auditLogger: AuditLogger,
  ) {}

  // Every day at 00:15 UTC.
  @Cron("15 0 * * *")
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
    | { archived: false; reason: "disabled" }
    | { archived: true; periodIds: readonly string[] }
  > {
    const settings = await this.snapshotAdminService.getSettings();
    if (settings.autoArchiveWeeksAfterPublish <= 0) {
      return { archived: false, reason: "disabled" };
    }

    const weeksMs = settings.autoArchiveWeeksAfterPublish * MS_PER_WEEK;
    const cutoff = new Date(now.getTime() - weeksMs);

    const candidates = await this.prisma.report.findMany({
      where: {
        status: "published",
        archived: false,
        publishedAt: { lt: cutoff, not: null },
        // A reopened period keeps the legacy tuple (status='published',
        // archived=false) and its original publishedAt, but reverts the
        // canonical `periodState` to 'open' (period-transition.ts `reopen`).
        // Without this guard a period reopened after its retention cutoff
        // matches all three legacy predicates and gets silently auto-archived,
        // destroying the in-progress editing session. periodState is the
        // canonical column (audit comment below) — exclude any reopened period.
        periodState: { not: "open" },
      },
      select: { id: true },
    });

    if (candidates.length === 0) {
      return { archived: true, periodIds: [] };
    }

    const archivedIds: string[] = [];
    for (const candidate of candidates) {
      try {
        // The autoArchive transition writes the legacy `archived` boolean, the
        // new `periodState` column, and the `autoArchived` audit flag as one
        // atomic row-level field set. The write re-asserts the candidate
        // predicates: a head can reopen a period between the candidate scan and
        // this write, and an unconditional update would then archive a row
        // whose sections the reopen just reset to draft. `periodStatus` is the
        // discriminator column the reopen compare-and-set flips, so a reopen
        // that wins the window drops this write to zero rows.
        const { count } = await this.prisma.report.updateMany({
          where: {
            id: candidate.id,
            archived: false,
            periodStatus: "published",
          },
          data: buildTransition("autoArchive", {}),
        });
        if (count === 0) {
          this.logger.log(
            `auto-archive skipped period=${candidate.id}: reopened or archived by a concurrent writer`,
          );
          continue;
        }
        this.logger.log(`auto-archive period=${candidate.id}`);
        this.auditLogger.periodAutoArchive({
          periodId: candidate.id,
          from: "published",
          to: "archived",
        });
        archivedIds.push(candidate.id);
      } catch (error) {
        this.logger.error(
          `auto-archive failed period=${candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { archived: true, periodIds: archivedIds };
  }
}
