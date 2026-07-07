import { MS_PER_WEEK } from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { queryActiveLeadsLastPublishedPeriod } from "./telemetry.queries.js";
import type { TelemetryRepository } from "./telemetry.service.js";

/**
 * Prisma-backed implementation of the
 * `TelemetryRepository` port consumed by TelemetryService. All queries
 * are scoped to the small N (last 1 or 4 periods, last 7 days) so the
 * read path stays sub-100ms even at 10K+ historical reports.
 */
@Injectable()
export class TelemetryPrismaRepository implements TelemetryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async reportsThisPeriodCount(): Promise<number> {
    // "This period" = the latest period by start date (any status),
    // because the headline "reports this period" number should not flip
    // to zero at the deadline boundary when a period transitions from
    // draft to published.
    const latest = await this.prisma.report.findFirst({
      orderBy: { periodStart: "desc" },
      select: { periodStart: true },
    });
    if (!latest) return 0;
    return this.prisma.report.count({
      where: { periodStart: latest.periodStart },
    });
  }

  activeLeadsLastPublishedPeriod(): Promise<number> {
    return queryActiveLeadsLastPublishedPeriod(this.prisma);
  }

  async lateSectionsLastPublishedPeriod(): Promise<number> {
    const report = await this.prisma.report.findFirst({
      where: { status: "published" },
      orderBy: { periodStart: "desc" },
      select: { id: true },
    });
    if (!report) return 0;
    return this.prisma.reportSection.count({
      where: { reportId: report.id, status: "submitted", late: true },
    });
  }

  async pendingReopenCount(): Promise<number> {
    return this.prisma.reopenRequest.count({
      where: { status: "pending" },
    });
  }

  async pdfExportsLast7d(): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - MS_PER_WEEK);
    // The Prisma `PdfExportJob` row uses `createdAt` (auto-stamp) rather
    // than the in-domain `requestedAt` — the domain `requestedAt` lives
    // only on the assembled job shape returned to callers, not on the
    // DB row.
    return this.prisma.pdfExportJob.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    });
  }

  async onTimeRatioPerPeriod(n: number): Promise<number[]> {
    // Walk the last `n` published periods oldest → newest (we fetch DESC
    // and reverse so we don't have to push an ORDER BY clause downstream).
    const reports = await this.prisma.report.findMany({
      where: { status: "published" },
      orderBy: { periodStart: "desc" },
      take: n,
      select: { id: true },
    });
    if (reports.length === 0) return [];

    const ratios: number[] = [];
    // Sequential queries (not Promise.all) so a degraded DB does not
    // light up `n` parallel slow queries; n is tiny (4) so latency cost
    // is negligible.
    for (const report of [...reports].reverse()) {
      const [total, onTime] = await Promise.all([
        this.prisma.reportSection.count({
          where: { reportId: report.id, status: "submitted" },
        }),
        this.prisma.reportSection.count({
          where: { reportId: report.id, status: "submitted", late: false },
        }),
      ]);
      if (total > 0) ratios.push(onTime / total);
    }
    return ratios;
  }
}
