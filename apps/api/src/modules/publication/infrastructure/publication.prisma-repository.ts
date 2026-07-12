import type { AssembledReport } from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { publishCompareAndSet } from "../../../lib/publish-compare-and-set.js";
import { buildTransition } from "../../period/index.js";
import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../../published-report-snapshot";
import type {
  AutoPublishResult,
  PublicationRepository,
  PublishReportOutcome,
} from "../application/publication.service";

/**
 * Re-read the just-published row through the SAME transaction client and freeze
 * its `publishedSnapshot` as a second statement inside that transaction. Both
 * publish writers build the immutable snapshot from this fresh in-transaction
 * read (never from an earlier separate round-trip), so a lead section-save that
 * commits between the assemble-read and the publish write is captured. `update`
 * cannot carry an `include`, hence the read-back; keeping it inside the
 * transaction keeps the lifecycle state and the snapshot atomic. Returns the
 * assembled report built from that same read, so the frozen snapshot and the
 * returned report are the same bytes.
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

  async publishAssembledReport(
    report: AssembledReport,
  ): Promise<PublishReportOutcome> {
    const before = await this.prisma.report.findUnique({
      where: { id: report.reportId },
      select: { periodStatus: true },
    });
    if (!before) {
      throw new Error(`Report ${report.reportId} was not found.`);
    }

    // Fast-path: a truly-published period is rejected. Keyed on `periodStatus`,
    // so a reopened period (periodStatus="reopened") is NOT short-circuited and
    // stays publishable.
    if (before.periodStatus === "published") {
      return {
        status: "already-published",
        report: await this.readAssembled(report.reportId),
      };
    }

    // Capture the prior status here, where the fast-path guard above has
    // narrowed it to a publishable state; TS discards that narrowing across the
    // transaction closure below.
    const priorPeriodStatus = before.periodStatus;

    return this.prisma.$transaction(async (tx) => {
      // Shared compare-and-set inside the transaction, mirroring
      // PeriodPrismaRepository.publishPeriod: the guarded predicate lets exactly
      // one of two concurrent publishes win, and the zero-row match is
      // disambiguated (raced vs archived) by a re-read through this same `tx`.
      // The lifecycle field set (single transition-writer invariant) is the
      // helper's `data`; the snapshot is frozen below from a fresh
      // in-transaction re-read, never from the earlier assemble-read.
      const outcome = await publishCompareAndSet(
        tx,
        report.reportId,
        this.publishLifecycle(report, false),
      );

      if (outcome === "raced") {
        return {
          status: "raced",
          report: await this.readAssembled(report.reportId),
        };
      }
      if (outcome === "archived") {
        return {
          status: "archived",
          report: await this.readAssembled(report.reportId),
        };
      }

      return {
        status: "transitioned",
        priorPeriodStatus,
        report: await freezeSnapshotInTx(tx, report.reportId),
      };
    });
  }

  private async readAssembled(reportId: string): Promise<AssembledReport> {
    const saved = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: reportFullIncludeForSnapshot,
    });

    if (!saved) {
      throw new Error(`Report ${reportId} was not found after save.`);
    }

    return buildAssembledReportFromPrismaRow(saved);
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
        data: this.publishLifecycle(report, true),
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
   * Build the publish lifecycle field set, sourcing the timestamp and (for the
   * manual path) the publisher id from the assembled report so the builder is
   * the only writer of those fields. A published report must carry a
   * `publishedAt`, and a manual publish must carry a `publishedById`; these are
   * guaranteed by `PublicationService.publishReport` / `publishAuto`, asserted
   * here so a malformed caller fails loudly instead of writing a torn row.
   */
  private publishLifecycle(report: AssembledReport, auto: boolean) {
    if (!report.publishedAt) {
      throw new Error(
        `Published report ${report.reportId} is missing publishedAt.`,
      );
    }
    if (auto) {
      return buildTransition("autoPublish", { now: report.publishedAt });
    }
    if (!report.publishedById) {
      throw new Error(
        `Manually published report ${report.reportId} is missing publishedById.`,
      );
    }
    return buildTransition("publish", {
      now: report.publishedAt,
      userId: report.publishedById,
    });
  }
}
