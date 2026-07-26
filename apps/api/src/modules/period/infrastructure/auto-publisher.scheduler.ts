import { MS_PER_HOUR } from "@customreport/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { AuditLogger } from "../../../lib/audit-logger.js";
import { errorMessage } from "../../../lib/error-message.js";
import { SnapshotAdminService } from "../../admin/index.js";
import { PublicationService } from "../../publication/index.js";

// Auto-publishes draft Reports past deadline+grace when opted in.
// No empty section stubs — missing sections render as placeholders at read time.
// See openspec/specs/period-dual-state.
@Injectable()
export class AutoPublisherScheduler {
  private readonly logger = new Logger(AutoPublisherScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotAdminService: SnapshotAdminService,
    private readonly publicationService: PublicationService,
    private readonly auditLogger: AuditLogger,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runHourly(): Promise<void> {
    await this.runOnce(new Date());
  }

  // Test seam: returns published periodIds without scraping audit calls.
  async runOnce(
    now: Date,
  ): Promise<
    | { published: false; reason: "disabled" }
    | { published: true; periodIds: readonly string[] }
  > {
    const settings = await this.snapshotAdminService.getSettings();
    if (!settings.autoPublishAfterDeadline) {
      return { published: false, reason: "disabled" };
    }

    const graceMs = settings.gracePeriodHours * MS_PER_HOUR;
    const cutoff = new Date(now.getTime() - graceMs);

    // archived:false — archive leaves status=draft; without this an archived
    // draft would promote to the invalid archived+published dual-state.
    const candidates = await this.prisma.report.findMany({
      where: {
        status: "draft",
        archived: false,
        deadline: { lt: cutoff },
      },
      orderBy: { deadline: "asc" },
      select: { id: true },
    });

    if (candidates.length === 0) {
      return { published: true, periodIds: [] };
    }

    // Folded sequentially — awaiting the pending tally first is what keeps one
    // publish in flight at a time; each period must settle before the next.
    const publishedIds = await candidates.reduce<Promise<readonly string[]>>(
      async (pending, candidate) => {
        const tally = await pending;
        const published = await this.publishOne(candidate.id);
        return published ? [...tally, candidate.id] : tally;
      },
      Promise.resolve([]),
    );

    return { published: true, periodIds: publishedIds };
  }

  // True only when this tick is the one that flipped the period to published.
  private async publishOne(periodId: string): Promise<boolean> {
    try {
      // Sole lifecycle writer here — a second report.update after publish
      // risks a torn autoPublished flag (see period-dual-state).
      const outcome = await this.publicationService.publishAuto(periodId);

      // Archived or already published between scan and CAS — expected no-op.
      if (!outcome.published) return false;
      // Manual publish won the race; do not audit as auto-publish.
      if (outcome.wasAlreadyPublished) return false;

      // Count post-publish so the audit number matches the head dashboard.
      const missingSectionsCount = await this.prisma.reportSection.count({
        where: { reportId: periodId, status: "draft" },
      });

      this.logger.log(
        `auto-publish period=${periodId} missing=${missingSectionsCount}`,
      );
      this.auditLogger.periodAutoPublish({
        periodId,
        missingSectionsCount,
        from: "open",
        to: "published",
      });
      return true;
    } catch (error) {
      // Single-period failures must not abort the tick — one bad
      // report should not block the rest of the queue. Log and move on.
      this.logger.error(
        `auto-publish failed period=${periodId}: ${errorMessage(error)}`,
      );
      return false;
    }
  }
}
