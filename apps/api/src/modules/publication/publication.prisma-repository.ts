import type { AssembledReport } from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { buildTransition } from "../period/period-transition.js";
import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../published-report-snapshot";
import type { PublicationRepository } from "./publication.service";

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

  async saveAssembledReport(
    report: AssembledReport,
    options: { auto?: boolean } = {},
  ): Promise<AssembledReport> {
    // refactor-period-transition-writer: the lifecycle field set comes from
    // the single transition builder, never hand-assembled here. A draft save
    // (e.g. a section-update through PublicationService.updateSectionForReview,
    // which rejects already-published reports) maps to `open`; a publish maps
    // to `publish` or `autoPublish` per the caller's explicit intent. We do
    // NOT infer auto-vs-manual from `publishedById` nullness — that is fragile.
    //
    // This is the fix for the long-standing periodStatus drift: the previous
    // hand-assembled write set `status`/`periodState` but never `periodStatus`,
    // so every report published through this path (manual `publishReport` AND
    // scheduler `publishAuto`) stayed at the default `periodStatus="open"` —
    // invisible to viewers (weekly-report.service rejects non-published
    // periodStatus) and unable to serve its snapshot. The `publish`/
    // `autoPublish` transitions write `periodStatus="published"` like the
    // `publishPeriod` path always did.
    const lifecycle =
      report.status === "published"
        ? this.publishLifecycle(report, options.auto ?? false)
        : buildTransition("open", {});

    await this.prisma.report.update({
      where: { id: report.reportId },
      // Snapshot + lifecycle share one `update`, so they stay atomic (no
      // separate round-trip can tear them apart).
      data: {
        ...lifecycle,
        ...(report.status === "published"
          ? { publishedSnapshot: toPublishedSnapshotJson(report) }
          : {}),
      },
    });

    const saved = await this.prisma.report.findUnique({
      where: { id: report.reportId },
      include: reportFullIncludeForSnapshot,
    });

    if (!saved) {
      throw new Error(`Report ${report.reportId} was not found after save.`);
    }

    return buildAssembledReportFromPrismaRow(saved);
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
