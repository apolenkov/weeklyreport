import type {
  LeadVelocityInput,
  LeadVelocityOutput,
  PeriodComparisonInput,
  PeriodComparisonOutput,
  TrafficLightCell,
  TrafficLightHistoryInput,
  TrafficLightHistoryOutput,
  UserSession,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  computeAllowedGroupIds,
  guardGroupScope,
} from "../../lib/group-scope.js";
import {
  filterPublishedSnapshotForSession,
  publishedReportScopeWhere,
  PublishedSnapshotIntegrityError,
  requirePublishedSnapshot,
} from "../report-sections/index.js";
import type { AnalyticsRepository } from "./analytics.service.js";
import {
  collectComparisonCells,
  collectProjectNames,
  groupReportsByLabel,
  isoDateOnly,
  nextUtcDay,
  startOfUtcDay,
  statusForProject,
  UNKNOWN_CELL,
} from "./analytics-period-math.js";

// Both lifecycle fields must confirm that editing is closed. Reopened reports
// retain their last snapshot for read-only history, but settled analytics must
// not surface it until the next publication.
const PUBLISHED_FLOOR = {
  status: "published" as const,
  periodStatus: "published" as const,
};

const publishedAnalyticsSelect = {
  id: true,
  periodEnd: true,
  createdAt: true,
  publishedSnapshot: true,
} as const;

interface PublishedAnalyticsRow {
  readonly id: string;
  readonly periodEnd: Date;
  readonly createdAt: Date;
  readonly publishedSnapshot: Prisma.JsonValue | null;
}

function mapPublishedAnalyticsReport(
  row: PublishedAnalyticsRow,
  session: UserSession,
  leadId?: string,
) {
  const snapshot = filterPublishedSnapshotForSession(
    requirePublishedSnapshot(row.publishedSnapshot, row.id),
    session,
  );
  const sections = snapshot.sections
    .filter((section) => leadId === undefined || section.authorId === leadId)
    .map((section) => ({
      authorId: section.authorId,
      author: { name: section.authorName },
      status: section.status,
      late: section.late,
      projectStatuses: section.projects.flatMap((project) =>
        project.trafficLight === null
          ? []
          : [
              {
                projectId: project.projectId,
                status: project.trafficLight,
                project: { name: project.projectName },
              },
            ],
      ),
      risks: section.risks.map((risk) => ({
        projectId: risk.projectId ?? null,
      })),
    }));
  if (
    sections.length === 0 &&
    (session.role !== "admin" || leadId !== undefined)
  ) {
    throw new PublishedSnapshotIntegrityError(
      `Published snapshot scope projection mismatch for report ${row.id}.`,
    );
  }

  return {
    id: row.id,
    periodEnd: snapshot.periodEnd,
    createdAt: row.createdAt,
    sections,
  };
}

function publishedSectionAdmission(
  session: UserSession,
  leadId?: string,
): Prisma.ReportWhereInput {
  if (leadId === undefined) return publishedReportScopeWhere(session);

  const scope: Prisma.PublishedSectionScopeWhereInput = {};
  if (session.role !== "admin") {
    scope.groupId = { in: [...computeAllowedGroupIds(session)] };
  }
  scope.authorId = leadId;

  return {
    publishedSectionScopes: {
      some: scope,
    },
  };
}

@Injectable()
export class AnalyticsPrismaRepository implements AnalyticsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  readonly trafficLightHistory = async (
    input: TrafficLightHistoryInput,
    session: UserSession,
  ): Promise<TrafficLightHistoryOutput> => {
    guardGroupScope(session);
    const reportRows = await this.prisma.report.findMany({
      where: {
        ...PUBLISHED_FLOOR,
        ...publishedSectionAdmission(session, input.leadId),
        periodStart: { gte: new Date(input.periodFrom) },
        // Half-open upper bound so a periodEnd later in the periodTo day is
        // still included (a bare `lte: midnight(periodTo)` drops it).
        periodEnd: { lt: nextUtcDay(input.periodTo) },
      },
      select: publishedAnalyticsSelect,
      orderBy: { periodEnd: "asc" },
    });

    const reports = reportRows
      .map((row) => mapPublishedAnalyticsReport(row, session, input.leadId))
      .filter((report) =>
        session.role === "admin" && input.leadId === undefined
          ? true
          : report.sections.length > 0,
      );

    const periods = Array.from(
      new Set(reports.map((r) => isoDateOnly(r.periodEnd))),
    );

    // Multiple reports can map to one date-label (a republished period, or two
    // periods differing only by periodStart), so aggregate per label instead of
    // reading the first match and dropping the rest.
    const reportsByLabel = groupReportsByLabel(reports);

    const projectMap = collectProjectNames(reports, input.projectId);

    const rows = Array.from(projectMap.entries()).map(
      ([projectId, projectName]) => {
        const statuses: TrafficLightCell[] = periods.map((label) =>
          statusForProject(reportsByLabel.get(label) ?? [], projectId),
        );
        return { projectId, projectName, statuses };
      },
    );

    return { periods, rows };
  };

  readonly leadVelocity = async (
    input: LeadVelocityInput,
    session: UserSession,
  ): Promise<LeadVelocityOutput> => {
    guardGroupScope(session);
    const reportRows = await this.prisma.report.findMany({
      where: {
        ...PUBLISHED_FLOOR,
        ...publishedSectionAdmission(session),
        periodStart: { gte: new Date(input.periodFrom) },
        // Half-open upper bound (parity with trafficLightHistory): include a
        // periodEnd later in the periodTo day.
        periodEnd: { lt: nextUtcDay(input.periodTo) },
      },
      select: publishedAnalyticsSelect,
      orderBy: { periodEnd: "asc" },
    });
    const reports = reportRows
      .map((row) => mapPublishedAnalyticsReport(row, session))
      .map((report) => ({
        ...report,
        sections: report.sections.filter(
          (section) => section.status === "submitted",
        ),
      }))
      .filter((report) => report.sections.length > 0);

    // Group by period label so a republished period (two reports sharing a
    // label) yields one row with both reports' leads, not a duplicate series
    // point — parity with trafficLightHistory's per-label aggregation.
    const reportsByLabel = groupReportsByLabel(reports);

    return Array.from(reportsByLabel.entries()).map(([periodLabel, group]) => {
      // One entry per lead within the label: a lead submitted in BOTH the
      // original and the republished report of the same period must count
      // once, or the row overstates that lead's velocity.
      const byLead = new Map(
        group
          .flatMap((r) => r.sections)
          .map((s) => [
            s.authorId,
            {
              leadId: s.authorId,
              leadName: s.author.name,
              submittedSections: 1,
            },
          ]),
      );
      return { periodLabel, leads: [...byLead.values()] };
    });
  };

  readonly periodComparison = async (
    input: PeriodComparisonInput,
    session: UserSession,
  ): Promise<PeriodComparisonOutput> => {
    guardGroupScope(session);
    const fetchAll = (date: string) =>
      this.prisma.report.findMany({
        where: {
          ...PUBLISHED_FLOOR,
          ...publishedSectionAdmission(session),
          // Day-range match: a date-only label must match a full-timestamp
          // periodEnd regardless of its time component.
          periodEnd: { gte: startOfUtcDay(date), lt: nextUtcDay(date) },
        },
        select: publishedAnalyticsSelect,
      });

    const [a, b] = await Promise.all([
      fetchAll(input.periodA),
      fetchAll(input.periodB),
    ]);

    const cellsA = collectComparisonCells(
      a.map((row) => mapPublishedAnalyticsReport(row, session)),
    );
    const cellsB = collectComparisonCells(
      b.map((row) => mapPublishedAnalyticsReport(row, session)),
    );

    const allProjectIds = new Set<string>([...cellsA.keys(), ...cellsB.keys()]);

    const rows = Array.from(allProjectIds).map((projectId) => {
      const ca = cellsA.get(projectId) ?? UNKNOWN_CELL;
      const cb = cellsB.get(projectId) ?? UNKNOWN_CELL;
      return {
        projectId,
        projectName: ca.name !== "Unknown" ? ca.name : cb.name,
        statusA: ca.status,
        statusB: cb.status,
        riskCountA: ca.risks,
        riskCountB: cb.risks,
        riskDelta: cb.risks - ca.risks,
      };
    });

    return { rows };
  };
}
