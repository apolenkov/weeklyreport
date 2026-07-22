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
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter, guardGroupScope } from "../../lib/group-scope.js";
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

/**
 * Analytics reads live sections, so both lifecycle fields must confirm that
 * editing is closed. Archive additionally requires `archived: true` and reads
 * only the frozen snapshot.
 */
const PUBLISHED_FLOOR = {
  status: "published" as const,
  periodStatus: "published" as const,
};

@Injectable()
export class AnalyticsPrismaRepository implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async trafficLightHistory(
    input: TrafficLightHistoryInput,
    session: UserSession,
  ): Promise<TrafficLightHistoryOutput> {
    guardGroupScope(session);
    // Load-bearing: a Report is a unified period holding sections from EVERY
    // group, and this method aggregates over the included sections — so the
    // scope must filter the nested `include.sections.where`, not only which
    // reports return. Admin → `{}` → omitted (sees all). Mirrors
    // weekly-report.prisma-repository.ts.
    const scope = groupScopeFilter(session, "reportSection");
    const scoped = Object.keys(scope).length > 0;
    const leadFilter = input.leadId ? { authorId: input.leadId } : {};
    // The same predicate gates BOTH which reports qualify (`where.sections.some`)
    // and which sections are aggregated (`include.sections.where`): a leadId
    // that reaches only the report qualifier still returns every in-scope lead's
    // sections, so it must land on the include too.
    const sectionWhere = { ...leadFilter, ...scope };
    const hasSectionWhere = scoped || Boolean(input.leadId);

    const reports = await this.prisma.report.findMany({
      where: {
        ...PUBLISHED_FLOOR,
        periodStart: { gte: new Date(input.periodFrom) },
        // Half-open upper bound so a periodEnd later in the periodTo day is
        // still included (a bare `lte: midnight(periodTo)` drops it).
        periodEnd: { lt: nextUtcDay(input.periodTo) },
        // Drop periods with no in-scope (and, if filtered, no matching-lead)
        // section. Omitted only when neither a scope nor a lead filter applies.
        ...(hasSectionWhere ? { sections: { some: sectionWhere } } : {}),
      },
      include: {
        sections: {
          ...(hasSectionWhere ? { where: sectionWhere } : {}),
          include: {
            projectStatuses: { include: { project: true } },
          },
        },
      },
      orderBy: { periodEnd: "asc" },
    });

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
  }

  async leadVelocity(
    input: LeadVelocityInput,
    session: UserSession,
  ): Promise<LeadVelocityOutput> {
    guardGroupScope(session);
    const scope = groupScopeFilter(session, "reportSection");
    const scoped = Object.keys(scope).length > 0;

    const reports = await this.prisma.report.findMany({
      where: {
        ...PUBLISHED_FLOOR,
        periodStart: { gte: new Date(input.periodFrom) },
        // Half-open upper bound (parity with trafficLightHistory): include a
        // periodEnd later in the periodTo day.
        periodEnd: { lt: nextUtcDay(input.periodTo) },
        // Drop periods with no in-scope section (admin → omitted).
        ...(scoped ? { sections: { some: scope } } : {}),
      },
      include: {
        sections: {
          // Preserve the submitted filter; add the group scope for non-admin.
          where: { status: "submitted", ...scope },
          include: { author: true },
        },
      },
      orderBy: { periodEnd: "asc" },
    });

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
  }

  async periodComparison(
    input: PeriodComparisonInput,
    session: UserSession,
  ): Promise<PeriodComparisonOutput> {
    guardGroupScope(session);
    const scope = groupScopeFilter(session, "reportSection");
    const scoped = Object.keys(scope).length > 0;

    const fetchAll = (date: string) =>
      this.prisma.report.findMany({
        where: {
          ...PUBLISHED_FLOOR,
          // Day-range match: a date-only label must match a full-timestamp
          // periodEnd regardless of its time component.
          periodEnd: { gte: startOfUtcDay(date), lt: nextUtcDay(date) },
          ...(scoped ? { sections: { some: scope } } : {}),
        },
        include: {
          sections: {
            ...(scoped ? { where: scope } : {}),
            include: {
              projectStatuses: { include: { project: true } },
              risks: true,
            },
          },
        },
      });

    const [a, b] = await Promise.all([
      fetchAll(input.periodA),
      fetchAll(input.periodB),
    ]);

    const cellsA = collectComparisonCells(a);
    const cellsB = collectComparisonCells(b);

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
  }
}
