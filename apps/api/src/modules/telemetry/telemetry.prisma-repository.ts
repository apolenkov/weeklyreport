import { MS_PER_WEEK, type UserSession } from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter, guardGroupScope } from "../../lib/group-scope.js";
import {
  queryActiveLeadsLastPublishedPeriod,
  querySettledPeriodIds,
} from "./telemetry.queries.js";
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
    const scoped = Object.keys(scope).length > 0;
    const [reportId] = await querySettledPeriodIds(
      this.prisma,
      1,
      scoped ? { sections: { some: scope } } : {},
    );
    if (!reportId) return 0;
    return this.prisma.reportSection.count({
      where: {
        reportId,
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
    const reportIds = await querySettledPeriodIds(
      this.prisma,
      n,
      scoped ? { sections: { some: scope } } : {},
    );
    if (reportIds.length === 0) return [];

    // Chain each period after the previous one so a degraded database receives
    // only two bounded count queries at a time.
    return [...reportIds]
      .reverse()
      .reduce<Promise<number[]>>(async (ratiosPromise, reportId) => {
        const ratios = await ratiosPromise;
        const [total, onTime] = await Promise.all([
          this.prisma.reportSection.count({
            where: { reportId, status: "submitted", ...scope },
          }),
          this.prisma.reportSection.count({
            where: {
              reportId,
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
