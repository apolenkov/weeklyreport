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
import { guardGroupScope } from "../../lib/group-scope.js";
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
  reportInEffectForPeriod,
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
  archived: false,
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
) {
  const snapshot = filterPublishedSnapshotForSession(
    requirePublishedSnapshot(row.publishedSnapshot, row.id),
    session,
  );
  const sections = snapshot.sections.map((section) => ({
    authorId: section.authorId,
    author: { name: section.authorName },
    status: section.status,
    late: section.late,
    projectStatuses: section.projects.map((project) => ({
      projectId: project.projectId,
      status: project.trafficLight,
      project: { name: project.projectName },
    })),
    risks: section.risks.map((risk) => ({
      projectId: risk.projectId ?? null,
    })),
  }));
  if (sections.length === 0 && session.role !== "admin") {
    throw new PublishedSnapshotIntegrityError(
      `Published snapshot scope projection mismatch for report ${row.id}.`,
    );
  }

  return {
    id: row.id,
    periodEnd: snapshot.periodEnd,
    createdAt: row.createdAt,
    publishedAt: snapshot.publishedAt,
    sections,
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
        ...publishedReportScopeWhere(session),
        periodStart: { gte: new Date(input.periodFrom) },
        // Half-open upper bound so a periodEnd later in the periodTo day is
        // still included (a bare `lte: midnight(periodTo)` drops it).
        periodEnd: { lt: nextUtcDay(input.periodTo) },
      },
      select: publishedAnalyticsSelect,
      orderBy: { periodEnd: "asc" },
    });

    const reportsByLabel = groupReportsByLabel(
      reportRows.map((row) => mapPublishedAnalyticsReport(row, session)),
    );
    const reports = [...reportsByLabel.values()].flatMap((group) => {
      const report = reportInEffectForPeriod(group);
      return report === undefined
        ? []
        : [
            {
              ...report,
              sections: report.sections.filter(
                (section) =>
                  input.leadId === undefined ||
                  section.authorId === input.leadId,
              ),
            },
          ];
    });
    const periods = reports.map((report) => isoDateOnly(report.periodEnd));

    const projectMap = collectProjectNames(reports, input.projectId);

    const rows = Array.from(projectMap.entries()).map(
      ([projectId, projectName]) => {
        const statuses: TrafficLightCell[] = reports.map((report) =>
          statusForProject([report], projectId),
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
        ...publishedReportScopeWhere(session),
        periodStart: { gte: new Date(input.periodFrom) },
        // Half-open upper bound (parity with trafficLightHistory): include a
        // periodEnd later in the periodTo day.
        periodEnd: { lt: nextUtcDay(input.periodTo) },
      },
      select: publishedAnalyticsSelect,
      orderBy: { periodEnd: "asc" },
    });
    const reportsByLabel = groupReportsByLabel(
      reportRows.map((row) => mapPublishedAnalyticsReport(row, session)),
    );

    return Array.from(reportsByLabel.entries()).flatMap(
      ([periodLabel, group]) => {
        const report = reportInEffectForPeriod(group);
        if (report === undefined) return [];
        const byLead = new Map(
          report.sections.map((section) => [
            section.authorId,
            {
              leadId: section.authorId,
              leadName: section.author.name,
              submittedSections: section.status === "submitted" ? 1 : 0,
            },
          ]),
        );
        return [{ periodLabel, leads: [...byLead.values()] }];
      },
    );
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
          ...publishedReportScopeWhere(session),
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
