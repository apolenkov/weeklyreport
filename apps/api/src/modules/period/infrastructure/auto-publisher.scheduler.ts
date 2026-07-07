import { MS_PER_HOUR } from "@customreport/shared";
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import type { AuditLogger } from "../../../lib/audit-logger.js";
import { AdminService } from "../../admin/admin.service";
import { PublicationService } from "../../publication/application/publication.service";

/**
 * Hourly scheduler that auto-publishes draft Reports whose `deadline +
 * gracePeriodHours` has passed and where the org has
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
    private readonly publicationService: PublicationService,
    private readonly auditLogger: AuditLogger,
  ) {}

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
    | { published: true; periodIds: readonly string[] }
  > {
    const settings = await this.adminService.getSettings();
    if (!settings.autoPublishAfterDeadline) {
      return { published: false, reason: "disabled" };
    }

    const graceMs = settings.gracePeriodHours * MS_PER_HOUR;
    const cutoff = new Date(now.getTime() - graceMs);

    // Candidate set: draft Reports whose deadline + grace is in the past.
    // `archived:false` excludes admin-archived periods: `archive` leaves
    // `status="draft"`, so without this guard an archived draft would match and
    // be promoted to `published` — the invalid `archived=true, periodState=
    // "published"` dual-state. Mirrors the auto-archiver candidate filter.
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

    const publishedIds: string[] = [];
    for (const candidate of candidates) {
      try {
        // `publishAuto` writes the COMPLETE autoPublish field set (status,
        // periodStatus, periodState, publishedAt, publishedById=null,
        // autoPublished=true) in a single guarded update. It is the sole
        // lifecycle writer here — a second `report.update` would be both
        // redundant and a torn-write hazard (a failure after the publish
        // commit would leave the now-`status=published` row never re-selected
        // by the `status:"draft"` candidate query, stuck at autoPublished=false).
        const outcome = await this.publicationService.publishAuto(candidate.id);

        if (!outcome.published) {
          // Skipped: the period was archived (or already published) between
          // candidate selection and the compare-and-set write, so it matched
          // zero rows. An expected no-op, distinct from the `catch` failure
          // branch — emit no audit, count no sections, and keep it out of
          // `periodIds`.
          continue;
        }

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
      } catch (error) {
        // Single-period failures must not abort the tick — one bad
        // report should not block the rest of the queue. Log and move on.
        this.logger.error(
          `auto-publish failed period=${candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { published: true, periodIds: publishedIds };
  }
}
