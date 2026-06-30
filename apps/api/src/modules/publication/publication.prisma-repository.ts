import type { AssembledReport } from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { buildTransition } from "../period/period-transition.js";
import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../published-report-snapshot";
import type {
  AutoPublishResult,
  PublicationRepository,
} from "./publication.service";

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

  async saveAssembledReport(report: AssembledReport): Promise<AssembledReport> {
    // The lifecycle field set comes from the single transition builder, never
    // hand-assembled here. A draft save (e.g. a section-update through
    // PublicationService.updateSectionForReview, which rejects already-published
    // reports) maps to `open`; a manual publish maps to `publish`. The auto path
    // does not route here — see `saveAutoPublishedReport`.
    //
    // The transition builder writes `periodStatus="published"` alongside
    // `status`/`periodState`. A prior hand-assembled write set `status` and
    // `periodState` but never `periodStatus`, leaving it at the default
    // `periodStatus="open"` — invisible to viewers (weekly-report.service
    // rejects non-published periodStatus) and unable to serve its snapshot.
    const lifecycle =
      report.status === "published"
        ? this.publishLifecycle(report, false)
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

  async saveAutoPublishedReport(
    report: AssembledReport,
  ): Promise<AutoPublishResult> {
    // Compare-and-set: the candidate-query `archived:false` filter cannot cover
    // a period archived BETWEEN selection and this write (the `archive`
    // transition leaves `status="draft"`, so neither the candidate filter nor a
    // `status="published"` idempotency check rejects it). Scoping the write to
    // rows still `status="draft"` and `archived=false` is the only point that
    // closes the race — a zero-row match means the row was archived or already
    // published after selection, and is skipped without a write.
    const { count } = await this.prisma.report.updateMany({
      where: { id: report.reportId, status: "draft", archived: false },
      data: {
        ...this.publishLifecycle(report, true),
        publishedSnapshot: toPublishedSnapshotJson(report),
      },
    });

    if (count === 0) {
      return { published: false };
    }

    const saved = await this.prisma.report.findUnique({
      where: { id: report.reportId },
      include: reportFullIncludeForSnapshot,
    });

    if (!saved) {
      throw new Error(`Report ${report.reportId} was not found after save.`);
    }

    return {
      published: true,
      report: buildAssembledReportFromPrismaRow(saved),
    };
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
