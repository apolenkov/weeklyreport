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
  comparePeriodThenCreated,
  isoDateOnly,
  nextUtcDay,
  startOfUtcDay,
  statusForProject,
} from "./analytics-period-math.js";

/**
 * AUTH-04 (Phase 28-01) parity: only published reports are visible to the
 * analytics surface, identical to ArchivePrismaRepository.PUBLISHED_FLOOR.
 */
const PUBLISHED_FLOOR = { status: "published" as const };

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

    const reports = await this.prisma.report.findMany({
      where: {
        ...PUBLISHED_FLOOR,
        periodStart: { gte: new Date(input.periodFrom) },
        // Half-open upper bound so a periodEnd later in the periodTo day is
        // still included (a bare `lte: midnight(periodTo)` drops it).
        periodEnd: { lt: nextUtcDay(input.periodTo) },
        // Drop periods with no in-scope (and, if filtered, no matching-lead)
        // section. Omitted only when neither a scope nor a lead filter applies.
        ...(scoped || input.leadId
          ? { sections: { some: { ...leadFilter, ...scope } } }
          : {}),
      },
      include: {
        sections: {
          ...(scoped ? { where: scope } : {}),
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
    const reportsByLabel = reports.reduce((acc, r) => {
      const label = isoDateOnly(r.periodEnd);
      return acc.set(label, [...(acc.get(label) ?? []), r]);
    }, new Map<string, (typeof reports)[number][]>());

    const projectMap = new Map<string, string>();
    for (const r of reports) {
      for (const s of r.sections) {
        for (const ps of s.projectStatuses) {
          if (input.projectId && ps.projectId !== input.projectId) continue;
          if (!projectMap.has(ps.projectId)) {
            projectMap.set(ps.projectId, ps.project.name);
          }
        }
      }
    }

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

    return reports.map((r) => ({
      periodLabel: isoDateOnly(r.periodEnd),
      leads: r.sections.map((s) => ({
        leadId: s.authorId,
        leadName: s.author.name,
        submittedSections: 1,
      })),
    }));
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

    interface Cell {
      status: TrafficLightCell;
      risks: number;
      name: string;
    }
    // Several reports can fall under one side's day range; process them oldest
    // first so the latest report's status wins (deterministic tie-break) while
    // risks accumulate across every contributing report.
    const collect = (
      reports: Awaited<ReturnType<typeof fetchAll>>,
    ): Map<string, Cell> => {
      const map = new Map<string, Cell>();
      const ordered = [...reports].sort(comparePeriodThenCreated);
      for (const report of ordered) {
        for (const section of report.sections) {
          for (const ps of section.projectStatuses) {
            const existing = map.get(ps.projectId);
            map.set(ps.projectId, {
              status: ps.status,
              risks: existing?.risks ?? 0,
              name: ps.project.name,
            });
          }
          for (const risk of section.risks) {
            // activity-first-class: an activity-parented risk (null product FK)
            // counts toward no product's risk tally.
            if (!risk.projectId) continue;
            const existing = map.get(risk.projectId) ?? {
              status: null,
              risks: 0,
              name: "Unknown",
            };
            map.set(risk.projectId, { ...existing, risks: existing.risks + 1 });
          }
        }
      }
      return map;
    };

    const cellsA = collect(a);
    const cellsB = collect(b);

    const allProjectIds = new Set<string>([...cellsA.keys(), ...cellsB.keys()]);

    const rows = Array.from(allProjectIds).map((projectId) => {
      const ca = cellsA.get(projectId) ?? {
        status: null,
        risks: 0,
        name: "Unknown",
      };
      const cb = cellsB.get(projectId) ?? {
        status: null,
        risks: 0,
        name: "Unknown",
      };
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
