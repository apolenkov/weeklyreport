import { Injectable } from "@nestjs/common";
import { type AssembledReport } from "@customreport/shared";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { PublicationRepository } from "./publication.service";
import {
  buildAssembledReportFromPrismaRow,
  reportFullIncludeForSnapshot,
  toPublishedSnapshotJson,
} from "../published-report-snapshot";

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
    // UFB-053 / Phase 51-C: mirror the legacy `status` write into the new
    // `periodState` column atomically. We don't translate any other
    // state — a `status='draft'` save (e.g. a section-update through
    // PublicationService.updateSectionForReview) maps to
    // periodState='open', and `status='published'` maps to
    // periodState='published'. Archive transitions never come through
    // this path (the AutoArchiver writes periodState='archived' directly).
    const nextPeriodState =
      report.status === "published" ? "published" : "open";

    await this.prisma.report.update({
      where: { id: report.reportId },
      data: {
        status: report.status,
        publishedAt: report.publishedAt,
        publishedById: report.publishedById,
        periodState: nextPeriodState,
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
}
