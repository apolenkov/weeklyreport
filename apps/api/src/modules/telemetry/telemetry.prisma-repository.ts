import { MS_PER_WEEK, type UserSession } from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter, guardGroupScope } from "../../lib/group-scope.js";
import type { TelemetryRepository } from "./telemetry.ports.js";
import {
  queryActiveLeadsLastPublishedPeriod,
  querySettledPeriodIds,
} from "./telemetry.queries.js";

@Injectable()
export class TelemetryPrismaRepository implements TelemetryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  readonly reportsThisPeriodCount = async (
    session: UserSession,
  ): Promise<number> => {
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
  };

  readonly activeLeadsLastPublishedPeriod = (
    session: UserSession,
  ): Promise<number> => {
    guardGroupScope(session);
    const scope = groupScopeFilter(session, "reportSection");
    return queryActiveLeadsLastPublishedPeriod(this.prisma, scope);
  };

  readonly lateSectionsLastPublishedPeriod = async (
    session: UserSession,
  ): Promise<number> => {
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
  };

  readonly pendingReopenCount = async (
    session: UserSession,
  ): Promise<number> => {
    guardGroupScope(session);
    const scope = groupScopeFilter(session, "reportSection");
    const scoped = Object.keys(scope).length > 0;
    return this.prisma.reopenRequest.count({
      where: {
        status: "pending",
        ...(scoped ? { reportSection: { is: scope } } : {}),
      },
    });
  };

  readonly pdfExportsLast7d = async (session: UserSession): Promise<number> => {
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
  };

  readonly onTimeRatioPerPeriod = async (
    n: number,
    session: UserSession,
  ): Promise<readonly number[]> => {
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
  };
}
