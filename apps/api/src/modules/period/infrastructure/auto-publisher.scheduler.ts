import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MS_PER_HOUR } from "@weeklyreport/shared";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { AUDIT_LOGGER, type AuditLogger } from "../../../lib/audit-logger.js";
import { errorMessage } from "../../../lib/error-message.js";
import { SnapshotAdminService } from "../../admin/index.js";
import { PublicationService } from "../../publication/index.js";

// A per-period publish outcome: `skipped` is the benign no-op (archived or
// already published between scan and write), `failed` is a real error that
// must be reported on the tick result.
type PublishCandidateOutcome =
  | { readonly published: true; readonly periodId: string }
  | { readonly published: false; readonly reason: "skipped" }
  | {
      readonly published: false;
      readonly reason: "failed";
      readonly error: string;
    };

export type AutoPublisherResult =
  | { readonly published: false; readonly reason: "disabled" }
  | {
      readonly published: true;
      readonly periodIds: readonly string[];
      readonly failures: readonly {
        readonly periodId: string;
        readonly error: string;
      }[];
    };

// Auto-publishes draft Reports past deadline+grace when opted in.
// No empty section stubs — missing sections render as placeholders at read time.
// See openspec/specs/period-dual-state.
@Injectable()
export class AutoPublisherScheduler {
  private readonly logger = new Logger(AutoPublisherScheduler.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SnapshotAdminService)
    private readonly snapshotAdminService: SnapshotAdminService,
    @Inject(PublicationService)
    private readonly publicationService: PublicationService,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async runHourly(): Promise<void> {
    await this.runOnce(new Date());
  }

  // Test seam: returns published periodIds and per-row failures without
  // scraping audit calls.
  async runOnce(now: Date): Promise<AutoPublisherResult> {
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
        periodState: "open",
        periodStatus: "open",
        deadline: { lt: cutoff },
      },
      orderBy: { deadline: "asc" },
      // Keep the exact deadline selected by this scan. The publication CAS
      // must reassert it because an admin may move or clear it before the
      // queued candidate reaches the writer.
      select: { id: true, deadline: true },
    });

    // Folded sequentially — awaiting the pending tally first is what keeps one
    // publish in flight at a time; each period must settle before the next.
    const { periodIds, failures } = await candidates.reduce<
      Promise<{
        readonly periodIds: readonly string[];
        readonly failures: readonly {
          readonly periodId: string;
          readonly error: string;
        }[];
      }>
    >(
      async (pending, candidate) => {
        const tally = await pending;
        // `deadline: { lt: cutoff }` above makes this non-null at runtime;
        // fail closed if the database ever returns an inconsistent row.
        const outcome =
          candidate.deadline === null
            ? ({ published: false, reason: "skipped" } as const)
            : await this.publishOne(candidate.id, now, candidate.deadline);
        if (outcome.published) {
          return {
            ...tally,
            periodIds: [...tally.periodIds, outcome.periodId],
          };
        }
        return outcome.reason === "failed"
          ? {
              ...tally,
              failures: [
                ...tally.failures,
                { periodId: candidate.id, error: outcome.error },
              ],
            }
          : tally;
      },
      Promise.resolve({ periodIds: [], failures: [] }),
    );

    return { published: true, periodIds, failures };
  }

  // True only when this tick is the one that flipped the period to published.
  private async publishOne(
    periodId: string,
    now: Date,
    expectedDeadline: Date,
  ): Promise<PublishCandidateOutcome> {
    try {
      // Sole lifecycle writer here — a second report.update after publish
      // risks a torn autoPublished flag (see period-dual-state). The tick time
      // is the explicit publishAt the domain boundary supplies.
      const outcome = await this.publicationService.publishAuto(
        periodId,
        now,
        expectedDeadline,
      );

      // Archived or already published between scan and CAS — expected no-op.
      if (!outcome.published) return { published: false, reason: "skipped" };
      // Manual publish won the race; do not audit as auto-publish.
      if (outcome.wasAlreadyPublished) {
        return { published: false, reason: "skipped" };
      }

      // The committed readback supplies the audit count without a fallible post-commit query.
      const missingSectionsCount = outcome.report.sections.filter(
        (section) => section.status === "draft",
      ).length;

      this.logger.log(
        `auto-publish period=${periodId} missing=${missingSectionsCount}`,
      );
      this.auditLogger.periodAutoPublish({
        periodId,
        missingSectionsCount,
        from: "open",
        to: "published",
      });
      return { published: true, periodId };
    } catch (error) {
      // Single-period failures must not abort the tick — one bad
      // report should not block the rest of the queue. Log and move on.
      const message = errorMessage(error);
      this.logger.error(`auto-publish failed period=${periodId}: ${message}`);
      return { published: false, reason: "failed", error: message };
    }
  }
}
