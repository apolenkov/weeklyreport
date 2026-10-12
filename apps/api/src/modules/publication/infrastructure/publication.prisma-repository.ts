import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AssembledReport } from "@weeklyreport/shared";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { buildTransition } from "../../period/index.js";
import {
  lockAllReminderPolicies,
  pauseReminderRulesForReport,
} from "../../reminders/index.js";
import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../../report-sections/index.js";
import { freezePublishedSnapshot } from "../../search/index.js";
import type {
  AutoPublishResult,
  PublicationRepository,
} from "../application/publication.service";

@Injectable()
export class PublicationPrismaRepository implements PublicationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getAssembledReport(
    activeReportId: string,
  ): Promise<AssembledReport | null> {
    const row = await this.prisma.report.findUnique({
      where: { id: activeReportId },
      include: reportFullIncludeForSnapshot,
    });

    if (!row) {
      return null;
    }

    return buildAssembledReportFromPrismaRow(row);
  }

  async saveAutoPublishedReport(
    report: AssembledReport,
    expectedDeadline: Date | null = report.deadline,
  ): Promise<AutoPublishResult> {
    return this.prisma.$transaction(
      async (tx) => {
        await lockAllReminderPolicies(tx);
        // The scheduler's assembled payload was read before this transaction
        // began. Re-read the complete live graph on the transaction client so
        // user/project/rule/group changes cannot be published from a stale
        // payload. RepeatableRead makes that graph and the lifecycle CAS one
        // coherent snapshot for the whole admission/write/freeze sequence.
        const currentRow = await tx.report.findUnique({
          where: { id: report.reportId },
          include: reportFullIncludeForSnapshot,
        });
        if (!currentRow) {
          return { published: false };
        }
        const currentReport = buildAssembledReportFromPrismaRow(currentRow);
        const candidate: AssembledReport = {
          ...currentReport,
          status: "published",
          publishedAt: report.publishedAt ?? new Date(),
          publishedById: null,
          publishedByName: "system",
        };
        // Compare-and-set on the complete editable identity. In particular, the
        // overdue deadline captured by the scheduler must still be exact: a
        // moved/cleared deadline is a stale candidate and must not publish.
        const { count } = await tx.report.updateMany({
          where: {
            id: candidate.reportId,
            status: "draft",
            archived: false,
            periodState: "open",
            periodStatus: "open",
            autoPublished: false,
            autoArchived: false,
            publishedAt: null,
            publishedById: null,
            reopenedAt: null,
            deadline: expectedDeadline,
          },
          data: {
            ...this.publishLifecycle(report),
            publishedSnapshot: toPublishedSnapshotJson(candidate),
          },
        });

        if (count === 0) {
          return { published: false };
        }

        await pauseReminderRulesForReport(tx, candidate.reportId);

        return {
          published: true,
          // This layer only ever performs the write — the idempotent
          // no-write short-circuit lives in `publishAuto`, above it.
          wasAlreadyPublished: false,
          report: await freezePublishedSnapshot(tx, candidate.reportId),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  // Build the autoPublish lifecycle field set, sourcing the timestamp from the
  // assembled report so the builder is the only writer of `publishedAt`; a
  // missing value fails loudly instead of writing a torn row.
  private publishLifecycle(report: AssembledReport) {
    if (!report.publishedAt) {
      throw new Error(
        `Published report ${report.reportId} is missing publishedAt.`,
      );
    }
    return buildTransition("autoPublish", { now: report.publishedAt });
  }
}
