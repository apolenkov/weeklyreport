import type { AssembledReport } from "@customreport/shared";
import { Injectable } from "@nestjs/common";
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

/**
 * Re-read the just-published row through the SAME transaction client and freeze
 * its `publishedSnapshot` as a second statement inside that transaction, so a
 * lead section-save that commits between the assemble-read and the publish
 * write is captured. `update` cannot carry an `include`, hence the read-back;
 * keeping it inside the transaction keeps the lifecycle state and the
 * snapshot atomic. Returns the assembled report built from that same read, so
 * the frozen snapshot and the returned report are the same bytes.
 */
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
  constructor(private readonly prisma: PrismaService) {}

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
      // Compare-and-set: the candidate-query `archived:false` filter cannot
      // cover a period archived BETWEEN selection and this write (the `archive`
      // transition leaves `status="draft"`, so neither the candidate filter nor
      // a `status="published"` idempotency check rejects it). Scoping the write
      // to rows still `status="draft"` and `archived=false` is the only point
      // that closes the race — a zero-row match means the row was archived or
      // already published after selection, and is skipped without a write. The
      // snapshot is frozen from a fresh in-transaction re-read as a second
      // statement, so its bytes reflect the latest committed state.
      const { count } = await tx.report.updateMany({
        where: { id: report.reportId, status: "draft", archived: false },
        data: this.publishLifecycle(report),
      });

      if (count === 0) {
        return { published: false };
      }

      return {
        published: true,
        report: await freezeSnapshotInTx(tx, report.reportId),
      };
    });
  }

  /**
   * Build the autoPublish lifecycle field set, sourcing the timestamp from the
   * assembled report so the builder is the only writer of that field. A
   * published report must carry a `publishedAt`, guaranteed by the caller
   * (`publishAuto`), asserted here so a malformed caller fails loudly instead
   * of writing a torn row.
   */
  private publishLifecycle(report: AssembledReport) {
    if (!report.publishedAt) {
      throw new Error(
        `Published report ${report.reportId} is missing publishedAt.`,
      );
    }
    return buildTransition("autoPublish", { now: report.publishedAt });
  }
}
