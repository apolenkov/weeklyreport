import { MS_PER_WEEK } from "@customreport/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { AUDIT_LOGGER, type AuditLogger } from "../../../lib/audit-logger.js";
import { SnapshotAdminService } from "../../admin/index.js";
import {
  lockAllReminderPolicies,
  pauseReminderRulesForReport,
} from "../../reminders/index.js";
import { buildTransition } from "../domain/period-transition.js";

// A per-candidate archive outcome: `skipped` is the benign lost-race no-op,
// `failed` is a real write error that must be reported on the tick result.
type ArchiveCandidateOutcome =
  | { readonly archived: true; readonly periodId: string }
  | { readonly archived: false; readonly reason: "skipped" }
  | {
      readonly archived: false;
      readonly reason: "failed";
      readonly error: string;
    };

export type AutoArchiverResult =
  | { readonly archived: false; readonly reason: "disabled" }
  | {
      readonly archived: true;
      readonly periodIds: readonly string[];
      readonly failures: readonly {
        readonly periodId: string;
        readonly error: string;
      }[];
    };

// Archives published Reports past publishedAt + retention. 0 weeks = never.
// 00:15 UTC offsets period-creator (00:05) to avoid lock contention.
// See openspec/specs/period-dual-state.
@Injectable()
export class AutoArchiverScheduler {
  private readonly logger = new Logger(AutoArchiverScheduler.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SnapshotAdminService)
    private readonly snapshotAdminService: SnapshotAdminService,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  @Cron("15 0 * * *")
  async runDaily(): Promise<void> {
    await this.runOnce(new Date());
  }

  // Test seam: returns archived periodIds and per-row failures without
  // scraping audit calls.
  async runOnce(now: Date): Promise<AutoArchiverResult> {
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
      // Keep the exact publication instant selected by this scan. The write
      // below must match it as well, otherwise a reopen+republish between the
      // scan and the CAS can make a fresh publication look stale.
      select: { id: true, publishedAt: true },
    });

    // Folded sequentially — awaiting the pending tally before the next write
    // keeps one guarded write in flight at a time; a failure must not abort
    // the remaining rows.
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
        // `publishedAt: { not: null }` above makes this non-null at runtime;
        // fail closed if the database ever returns an inconsistent row.
        const outcome =
          candidate.publishedAt === null
            ? ({ archived: false, reason: "skipped" } as const)
            : await this.archiveCandidate(candidate.id, candidate.publishedAt);
        if (outcome.archived) {
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

    return { archived: true, periodIds, failures };
  }

  // The periodId when this run is the one that archived it; a concurrent
  // writer that won the race is a benign skip, a write error is a failure.
  private async archiveCandidate(
    periodId: string,
    expectedPublishedAt: Date,
  ): Promise<ArchiveCandidateOutcome> {
    try {
      // Compare-and-set on the full selected publication identity. A reopen
      // followed by republish can leave the same id published and non-archived;
      // matching publishedAt prevents this stale scan from archiving it.
      const count = await this.prisma.$transaction(async (tx) => {
        await lockAllReminderPolicies(tx);
        const result = await tx.report.updateMany({
          where: {
            id: periodId,
            archived: false,
            periodStatus: "published",
            publishedAt: expectedPublishedAt,
          },
          data: buildTransition("autoArchive", {}),
        });
        if (result.count === 1) {
          await pauseReminderRulesForReport(tx, periodId);
        }
        return result.count;
      });
      if (count === 0) {
        this.logger.log(
          `auto-archive skipped period=${periodId}: reopened or archived by a concurrent writer`,
        );
        return { archived: false, reason: "skipped" };
      }
      this.logger.log(`auto-archive period=${periodId}`);
      this.auditLogger.periodAutoArchive({
        periodId,
        from: "published",
        to: "archived",
      });
      return { archived: true, periodId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`auto-archive failed period=${periodId}: ${message}`);
      return { archived: false, reason: "failed", error: message };
    }
  }
}
