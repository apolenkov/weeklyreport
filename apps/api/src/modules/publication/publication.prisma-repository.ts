import { Injectable } from "@nestjs/common";
import {
  assembledReportSchema,
  type AssembledReport,
} from "@customreport/shared";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { PublicationRepository } from "./publication.service";
import {
  reportSectionFullInclude,
  mapPrismaToReportSection,
} from "../report-sections/report-sections.prisma-repository";

/** Prisma include for a full report with all sections and their nested relations. */
const reportFullInclude = {
  sections: { include: reportSectionFullInclude },
  publishedBy: true,
} as const;

@Injectable()
export class PublicationPrismaRepository implements PublicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getAssembledReport(
    activeReportId: string,
  ): Promise<AssembledReport | null> {
    const row = await this.prisma.report.findUnique({
      where: { id: activeReportId },
      include: reportFullInclude,
    });

    if (!row) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = (row.sections as any[]).map(mapPrismaToReportSection);

    return assembledReportSchema.parse({
      reportId: row.id,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      deadline: row.deadline,
      status: row.status,
      publishedAt: row.publishedAt,
      publishedById: row.publishedById,
      publishedByName: row.publishedBy?.name ?? null,
      portfolioOverview: {
        status: "green",
        totals: { green: 0, yellow: 0, red: 0 },
      },
      sections,
    });
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
      },
    });

    const saved = await this.prisma.report.findUnique({
      where: { id: report.reportId },
      include: reportFullInclude,
    });

    if (!saved) {
      throw new Error(`Report ${report.reportId} was not found after save.`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = (saved.sections as any[]).map(mapPrismaToReportSection);

    return assembledReportSchema.parse({
      reportId: saved.id,
      periodStart: saved.periodStart,
      periodEnd: saved.periodEnd,
      deadline: saved.deadline,
      status: saved.status,
      publishedAt: saved.publishedAt,
      publishedById: saved.publishedById,
      publishedByName: saved.publishedBy?.name ?? null,
      portfolioOverview: report.portfolioOverview,
      sections,
    });
  }
}
