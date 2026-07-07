import type { AssembledReport } from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { publishCompareAndSet } from "../../../lib/publish-compare-and-set.js";
import { buildTransition } from "../../period/domain/period-transition.js";
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
    // Draft-save path only (e.g. a section-update through
    // PublicationService.updateSectionForReview, which rejects already-published
    // reports). The lifecycle field set comes from the single transition builder
    // via the `open` transition, never hand-assembled here. Manual publish goes
    // through `publishAssembledReport` and the auto path through
    // `saveAutoPublishedReport`, so neither publish writer can be reached here
    // without its compare-and-set guard.
    await this.prisma.report.update({
      where: { id: report.reportId },
      data: { ...buildTransition("open", {}) },
    });

    return this.readAssembled(report.reportId);
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

    // Shared compare-and-set: the guarded predicate lets exactly one of two
    // concurrent publishes win, and the zero-row match is disambiguated (raced
    // vs archived) by a direct re-read through the base client — this path has
    // NO surrounding transaction, so single-statement execution is its only
    // atomicity. The lifecycle field set (single transition-writer invariant)
    // AND the snapshot therefore ride the SAME guarded `updateMany` `data`.
    const outcome = await publishCompareAndSet(this.prisma, report.reportId, {
      ...this.publishLifecycle(report, false),
      publishedSnapshot: toPublishedSnapshotJson(report),
    });

    const saved = await this.readAssembled(report.reportId);

    if (outcome === "raced") {
      return { status: "raced", report: saved };
    }
    if (outcome === "archived") {
      return { status: "archived", report: saved };
    }

    return {
      status: "transitioned",
      priorPeriodStatus: before.periodStatus,
      report: saved,
    };
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
