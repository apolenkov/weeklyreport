import type { AssembledReport } from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { buildTransition } from "../../period/index.js";
import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../../published-report-snapshot";
import type {
  AutoPublishResult,
  PublicationRepository,
} from "../application/publication.service";

// Re-read the just-published row through the SAME transaction client and freeze
// its `publishedSnapshot` as a second statement, so a lead save committing
// between assemble-read and publish write is captured (`update` has no include).
async function freezeSnapshotInTx(
  tx: Prisma.TransactionClient,
  reportId: string,
): Promise<AssembledReport> {
  const row = await tx.report.findUniqueOrThrow({
    where: { id: reportId },
    include: reportFullIncludeForSnapshot,
  });
  const snapshot = buildAssembledReportFromPrismaRow(row);
  await tx.report.update({
    where: { id: reportId },
    data: { publishedSnapshot: toPublishedSnapshotJson(snapshot) },
  });
  return snapshot;
}

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
  ): Promise<AutoPublishResult> {
    return this.prisma.$transaction(async (tx) => {
      // Compare-and-set: the candidate `archived:false` filter cannot cover a
      // period archived between selection and this write, so scoping the write
      // to `status="draft"` + `archived=false` closes the race (zero-row skips).
      const { count } = await tx.report.updateMany({
        where: { id: report.reportId, status: "draft", archived: false },
        data: this.publishLifecycle(report),
      });

      if (count === 0) {
        return { published: false };
      }

      return {
        published: true,
        // This layer only ever performs the write — the idempotent
        // no-write short-circuit lives in `publishAuto`, above it.
        wasAlreadyPublished: false,
        report: await freezeSnapshotInTx(tx, report.reportId),
      };
    });
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
