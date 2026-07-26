import { MS_PER_WEEK } from "@customreport/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { AuditLogger } from "../../../lib/audit-logger.js";
import { SnapshotAdminService } from "../../admin/index.js";
import { buildTransition } from "../domain/period-transition.js";

// Archives published Reports past publishedAt + retention. 0 weeks = never.
// 00:15 UTC offsets period-creator (00:05) to avoid lock contention.
// See openspec/specs/period-dual-state.
@Injectable()
export class AutoArchiverScheduler {
  private readonly logger = new Logger(AutoArchiverScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotAdminService: SnapshotAdminService,
    private readonly auditLogger: AuditLogger,
  ) {}

  @Cron("15 0 * * *")
  async runDaily(): Promise<void> {
    await this.runOnce(new Date());
  }

  // Test seam: returns archived periodIds without scraping audit calls.
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
        // Reopened periods keep status=published/archived=false but periodState=open;
        // without this guard they would be auto-archived mid-edit.
        periodState: { not: "open" },
      },
      select: { id: true },
    });

    if (candidates.length === 0) {
      return { archived: true, periodIds: [] };
    }

    // Folded sequentially — awaiting the pending tally before the next write
    // keeps one guarded write in flight at a time; a failure must not abort
    // the remaining rows.
    const archivedIds = await candidates.reduce<Promise<readonly string[]>>(
      async (pending, candidate) => {
        const tally = await pending;
        const archivedId = await this.archiveCandidate(candidate.id);
        return archivedId === null ? tally : [...tally, archivedId];
      },
      Promise.resolve([]),
    );

    return { archived: true, periodIds: archivedIds };
  }

  // Returns the periodId when this run is the one that archived it; null when
  // a concurrent writer won the race or the write failed (logged, never thrown).
  private async archiveCandidate(periodId: string): Promise<string | null> {
    try {
      // Compare-and-set on periodStatus so a reopen between scan and write
      // drops this update to zero rows (see period-dual-state).
      const { count } = await this.prisma.report.updateMany({
        where: { id: periodId, archived: false, periodStatus: "published" },
        data: buildTransition("autoArchive", {}),
      });
      if (count === 0) {
        this.logger.log(
          `auto-archive skipped period=${periodId}: reopened or archived by a concurrent writer`,
        );
        return null;
      }
      this.logger.log(`auto-archive period=${periodId}`);
      this.auditLogger.periodAutoArchive({
        periodId,
        from: "published",
        to: "archived",
      });
      return periodId;
    } catch (error) {
      this.logger.error(
        `auto-archive failed period=${periodId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
