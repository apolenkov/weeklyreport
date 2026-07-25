import { MS_PER_WEEK, type UserSession } from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter, guardGroupScope } from "../../lib/group-scope.js";
import { queryActiveLeadsLastPublishedPeriod } from "./telemetry.queries.js";
import type { TelemetryRepository } from "./telemetry.service.js";

@Injectable()
export class TelemetryPrismaRepository implements TelemetryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async reportsThisPeriodCount(session: UserSession): Promise<number> {
    guardGroupScope(session);
    const scope = groupScopeFilter(session, "reportSection");
    const scoped = Object.keys(scope).length > 0;
    // Latest period by start (any status) so the headline does not flip to
    // zero at the draft→published deadline boundary.
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
    // DB row has createdAt only; domain requestedAt is assembled for callers.
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
