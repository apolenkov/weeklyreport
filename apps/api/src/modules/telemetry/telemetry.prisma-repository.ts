import { MS_PER_WEEK, type UserSession } from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma as PrismaTypes } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  computeAllowedGroupIds,
  groupScopeFilter,
  guardGroupScope,
} from "../../lib/group-scope.js";
import { currentEditableReportWhere } from "../../lib/report-lifecycle.js";
import { publishedReportScopeWhere } from "../report-sections/index.js";
import type {
  TelemetryOnTimeWindow,
  TelemetryRepository,
} from "./telemetry.ports.js";
import {
  queryActiveLeadsLastPublishedPeriod,
  querySettledPeriodSnapshots,
  settledPublicationWhere,
} from "./telemetry.queries.js";

function reportVisibilityWhere(
  session: UserSession,
): PrismaTypes.ReportWhereInput {
  const scoped = session.role !== "admin";
  const liveScope = scoped ? groupScopeFilter(session, "reportSection") : {};
  return {
    OR: [
      {
        ...settledPublicationWhere(),
        ...(scoped ? publishedReportScopeWhere(session) : {}),
      },
      {
        ...currentEditableReportWhere(),
        ...(scoped ? { sections: { some: liveScope } } : {}),
      },
    ],
  };
}

@Injectable()
export class TelemetryPrismaRepository implements TelemetryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  readonly reportsThisPeriodCount = async (
    session: UserSession,
  ): Promise<number> => {
    guardGroupScope(session);
    const visibility = reportVisibilityWhere(session);
    // Current/reopened periods use live ownership; settled publications use
    // their indexed frozen projection. Resolve one latest visible start, then
    // let Postgres count that exact period instead of loading report history.
    const latest = await this.prisma.report.findFirst({
      where: visibility,
      orderBy: { periodStart: "desc" },
      select: { periodStart: true },
    });
    if (!latest) return 0;
    return this.prisma.report.count({
      where: { periodStart: latest.periodStart, ...visibility },
    });
  };

  readonly activeLeadsLastPublishedPeriod = (
    session: UserSession,
  ): Promise<number> => {
    guardGroupScope(session);
    return queryActiveLeadsLastPublishedPeriod(this.prisma, session);
  };

  readonly lateSectionsLastPublishedPeriod = async (
    session: UserSession,
  ): Promise<number> => {
    guardGroupScope(session);
    const [snapshot] = await querySettledPeriodSnapshots(
      this.prisma,
      1,
      session,
    );
    if (!snapshot) return 0;
    return snapshot.sections.filter(
      (section) => section.status === "submitted" && section.late,
    ).length;
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
    const sevenDaysAgo = new Date(Date.now() - MS_PER_WEEK);
    const where = { createdAt: { gte: sevenDaysAgo } };
    if (session.role === "admin") {
      return this.prisma.pdfExportJob.count({ where });
    }
    const groupIds = computeAllowedGroupIds(session);
    if (groupIds.length === 0) return 0;
    return this.prisma.pdfExportJob.count({
      where: { ...where, publicationGroupIds: { hasSome: [...groupIds] } },
    });
  };

  readonly onTimeRatioPerPeriod = async (
    n: number,
    session: UserSession,
  ): Promise<TelemetryOnTimeWindow> => {
    guardGroupScope(session);
    const snapshots = await querySettledPeriodSnapshots(
      this.prisma,
      n,
      session,
    );

    const ratio = (snapshot: (typeof snapshots)[number]): number | null => {
      const submitted = snapshot.sections.filter(
        (section) => section.status === "submitted",
      );
      return submitted.length === 0
        ? null
        : submitted.filter((section) => !section.late).length /
            submitted.length;
    };
    return {
      latestPeriodRatio: snapshots[0] ? ratio(snapshots[0]) : null,
      ratios: [...snapshots].reverse().flatMap((snapshot) => {
        const value = ratio(snapshot);
        return value === null ? [] : [value];
      }),
    };
  };
}
