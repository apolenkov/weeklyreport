import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AdminService } from "../admin/admin.service";
import { PublicationService } from "../publication/publication.service";
import type { AuditLogger } from "../../lib/audit-logger.js";
import { createNullAuditLogger } from "../../lib/audit-logger.js";

/**
 * UFB-049 / Phase 50-B: hourly scheduler that auto-publishes draft Reports
 * whose `deadline + gracePeriodHours` has passed and where the org has
 * opted in via `AppSettings.autoPublishAfterDeadline=true`.
 *
 * Missing sections render as «Не сдал» placeholders at read time — we do
 * NOT stub empty ReportSection rows in the DB. Keeps history clean and
 * `ReportSection.late` semantics intact (no row → never submitted).
 *
 * Idempotency: each candidate Report is fetched via
 * `PublicationService.publishAuto`, which short-circuits when the report
 * is already published. The scheduler iterates one report at a time so
 * a single slow-write does not stall the whole tick.
 *
 * Cron: fires every hour. The grace window can be sub-hour (minimum 0h)
 * but the auto-publish granularity is hourly — a deadline at 18:00 with
 * grace=2h auto-publishes at 21:00 (next top-of-hour after 20:00).
 */
@Injectable()
export class AutoPublisherScheduler {
  private readonly logger = new Logger(AutoPublisherScheduler.name);
  private readonly auditLogger: AuditLogger;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
    private readonly publicationService: PublicationService,
    auditLogger?: AuditLogger,
  ) {
    this.auditLogger = auditLogger ?? createNullAuditLogger();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runHourly(): Promise<void> {
    await this.runOnce(new Date());
  }

  /**
   * Test seam. Returns the list of published periodIds so unit tests can
   * assert "fires when eligible" / "skips when disabled" without scraping
   * audit calls.
   */
  async runOnce(
    now: Date,
  ): Promise<
    | { published: false; reason: "disabled" }
    | { published: true; periodIds: ReadonlyArray<string> }
  > {
    const settings = await this.adminService.getSettings();
    if (!settings.autoPublishAfterDeadline) {
      return { published: false, reason: "disabled" };
    }

    const graceMs = settings.gracePeriodHours * 3_600_000;
    const cutoff = new Date(now.getTime() - graceMs);

    // Candidate set: draft Reports whose deadline + grace is in the past.
    const candidates = await this.prisma.report.findMany({
      where: {
        status: "draft",
        deadline: { lt: cutoff },
      },
      orderBy: { deadline: "asc" },
      select: { id: true },
    });

    if (candidates.length === 0) {
      return { published: true, periodIds: [] };
    }

    const publishedIds: string[] = [];
    for (const candidate of candidates) {
      try {
        await this.publicationService.publishAuto(candidate.id);

        // UFB-053 / Phase 51-C: stamp the explicit state column AND the
        // `autoPublished` audit flag from 51-A. The legacy `status` and
        // `periodStatus` writes already happened inside `publishAuto`
        // (see publication.prisma-repository); this update is additive
        // and idempotent.
        await this.prisma.report.update({
          where: { id: candidate.id },
          data: { periodState: "published", autoPublished: true },
        });

        // Count sections that never reached `submitted` status; these
        // render as «Не сдал» placeholders downstream. Counted post-
        // publish so the audit number matches what the head dashboard
        // will surface.
        const missingSectionsCount = await this.prisma.reportSection.count({
          where: { reportId: candidate.id, status: "draft" },
        });

        this.logger.log(
          `auto-publish period=${candidate.id} missing=${missingSectionsCount}`,
        );
        this.auditLogger.periodAutoPublish({
          periodId: candidate.id,
          missingSectionsCount,
          from: "open",
          to: "published",
        });
        publishedIds.push(candidate.id);
      } catch (err) {
        // Single-period failures must not abort the tick — one bad
        // report should not block the rest of the queue. Log and move on.
        this.logger.error(
          `auto-publish failed period=${candidate.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { published: true, periodIds: publishedIds };
  }
}
