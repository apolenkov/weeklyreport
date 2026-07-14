import { MS_PER_WEEK, type UserSession } from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter, guardGroupScope } from "../../lib/group-scope.js";
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

  async reportsThisPeriodCount(session: UserSession): Promise<number> {
    guardGroupScope(session);
    const scope = groupScopeFilter(session, "reportSection");
    const scoped = Object.keys(scope).length > 0;
    // "This period" = the latest period by start date (any status),
    // because the headline "reports this period" number should not flip
    // to zero at the deadline boundary when a period transitions from
    // draft to published.
    const latest = await this.prisma.report.findFirst({
      where: { ...(scoped ? { sections: { some: scope } } : {}) },
      orderBy: { periodStart: "desc" },
      select: { periodStart: true },
    });
    if (!latest) return 0;
    return this.prisma.report.count({
      where: {
        periodStart: latest.periodStart,
        ...(scoped ? { sections: { some: scope } } : {}),
      },
    });
  }

  activeLeadsLastPublishedPeriod(session: UserSession): Promise<number> {
    guardGroupScope(session);
    const scope = groupScopeFilter(session, "reportSection");
    return queryActiveLeadsLastPublishedPeriod(this.prisma, scope);
  }

  async lateSectionsLastPublishedPeriod(session: UserSession): Promise<number> {
    guardGroupScope(session);
    const scope = groupScopeFilter(session, "reportSection");
    const report = await this.prisma.report.findFirst({
      where: { status: "published" },
      orderBy: { periodStart: "desc" },
      select: { id: true },
    });
    if (!report) return 0;
    return this.prisma.reportSection.count({
      where: {
        reportId: report.id,
        status: "submitted",
        late: true,
        ...scope,
      },
    });
  }

  async pendingReopenCount(session: UserSession): Promise<number> {
    guardGroupScope(session);
    const scope = groupScopeFilter(session, "reportSection");
    const scoped = Object.keys(scope).length > 0;
    return this.prisma.reopenRequest.count({
      where: {
        status: "pending",
        ...(scoped ? { reportSection: { is: scope } } : {}),
      },
    });
  }

  async pdfExportsLast7d(session: UserSession): Promise<number> {
    guardGroupScope(session);
    const scope = groupScopeFilter(session, "reportSection");
    const scoped = Object.keys(scope).length > 0;
    const sevenDaysAgo = new Date(Date.now() - MS_PER_WEEK);
    // The Prisma `PdfExportJob` row uses `createdAt` (auto-stamp) rather
    // than the in-domain `requestedAt` — the domain `requestedAt` lives
    // only on the assembled job shape returned to callers, not on the
    // DB row.
    return this.prisma.pdfExportJob.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
        ...(scoped ? { report: { is: { sections: { some: scope } } } } : {}),
      },
    });
  }

  async onTimeRatioPerPeriod(
    n: number,
    session: UserSession,
  ): Promise<number[]> {
    guardGroupScope(session);
    const scope = groupScopeFilter(session, "reportSection");
    const scoped = Object.keys(scope).length > 0;
    // Walk the last `n` published periods oldest → newest (we fetch DESC
    // and reverse before reducing the results in display order).
    const reports = await this.prisma.report.findMany({
      where: {
        status: "published",
        ...(scoped ? { sections: { some: scope } } : {}),
      },
      orderBy: { periodStart: "desc" },
      take: n,
      select: { id: true },
    });
    if (reports.length === 0) return [];

    // Chain each period after the previous one so a degraded database receives
    // only two bounded count queries at a time.
    return [...reports]
      .reverse()
      .reduce<Promise<number[]>>(async (ratiosPromise, report) => {
        const ratios = await ratiosPromise;
        const [total, onTime] = await Promise.all([
          this.prisma.reportSection.count({
            where: { reportId: report.id, status: "submitted", ...scope },
          }),
          this.prisma.reportSection.count({
            where: {
              reportId: report.id,
              status: "submitted",
              late: false,
              ...scope,
            },
          }),
        ]);
        return total > 0 ? [...ratios, onTime / total] : ratios;
      }, Promise.resolve([]));
  }
}
