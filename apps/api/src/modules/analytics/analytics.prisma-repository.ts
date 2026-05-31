import type {
  LeadVelocityInput,
  LeadVelocityOutput,
  PeriodComparisonInput,
  PeriodComparisonOutput,
  TrafficLightCell,
  TrafficLightHistoryInput,
  TrafficLightHistoryOutput,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AnalyticsRepository } from "./analytics.service.js";

/**
 * AUTH-04 (Phase 28-01) parity: only published reports are visible to the
 * analytics surface, identical to ArchivePrismaRepository.PUBLISHED_FLOOR.
 */
const PUBLISHED_FLOOR = { status: "published" as const };

/**
 * Format a Date as the UTC date-only ISO string (YYYY-MM-DD). This is
 * TZ-stable because Date.prototype.toISOString always returns UTC.
 */
function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class AnalyticsPrismaRepository implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async trafficLightHistory(
    input: TrafficLightHistoryInput,
  ): Promise<TrafficLightHistoryOutput> {
    const reports = await this.prisma.report.findMany({
      where: {
        ...PUBLISHED_FLOOR,
        periodStart: { gte: new Date(input.periodFrom) },
        periodEnd: { lte: new Date(input.periodTo) },
        ...(input.leadId
          ? { sections: { some: { authorId: input.leadId } } }
          : {}),
      },
      include: {
        sections: {
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

    const projectMap = new Map<string, string>();
    for (const r of reports) {
      for (const s of r.sections) {
        for (const ps of s.projectStatuses) {
          if (input.projectId && ps.projectId !== input.projectId) continue;
          if (!projectMap.has(ps.projectId)) {
            projectMap.set(ps.projectId, ps.project?.name ?? "Unknown");
          }
        }
      }
    }

    const rows = Array.from(projectMap.entries()).map(
      ([projectId, projectName]) => {
        const statuses: TrafficLightCell[] = periods.map((label) => {
          const r = reports.find((rr) => isoDateOnly(rr.periodEnd) === label);
          if (!r) return null;
          for (const s of r.sections) {
            const hit = s.projectStatuses.find(
              (ps) => ps.projectId === projectId,
            );
            if (hit) return hit.status as TrafficLightCell;
          }
          return null;
        });
        return { projectId, projectName, statuses };
      },
    );

    return { periods, rows };
  }

  async leadVelocity(input: LeadVelocityInput): Promise<LeadVelocityOutput> {
    const reports = await this.prisma.report.findMany({
      where: {
        ...PUBLISHED_FLOOR,
        periodStart: { gte: new Date(input.periodFrom) },
        periodEnd: { lte: new Date(input.periodTo) },
      },
      include: {
        sections: {
          where: { status: "submitted" },
          include: { author: true },
        },
      },
      orderBy: { periodEnd: "asc" },
    });

    return reports.map((r) => ({
      periodLabel: isoDateOnly(r.periodEnd),
      leads: r.sections.map((s) => ({
        leadId: s.authorId,
        leadName: s.author?.name ?? "Unknown",
        submittedSections: 1,
      })),
    }));
  }

  async periodComparison(
    input: PeriodComparisonInput,
  ): Promise<PeriodComparisonOutput> {
    const fetchOne = (periodEnd: string) =>
      this.prisma.report.findFirst({
        where: { ...PUBLISHED_FLOOR, periodEnd: new Date(periodEnd) },
        include: {
          sections: {
            include: {
              projectStatuses: { include: { project: true } },
              risks: true,
            },
          },
        },
      });

    const [a, b] = await Promise.all([
      fetchOne(input.periodA),
      fetchOne(input.periodB),
    ]);

    type Cell = { status: TrafficLightCell; risks: number; name: string };
    const collect = (
      report: NonNullable<Awaited<ReturnType<typeof fetchOne>>> | null,
    ): Map<string, Cell> => {
      const map = new Map<string, Cell>();
      if (!report) return map;
      for (const section of report.sections) {
        for (const ps of section.projectStatuses) {
          const existing = map.get(ps.projectId);
          map.set(ps.projectId, {
            status: ps.status as TrafficLightCell,
            risks: existing?.risks ?? 0,
            name: ps.project?.name ?? existing?.name ?? "Unknown",
          });
        }
        for (const risk of section.risks) {
          const existing = map.get(risk.projectId) ?? {
            status: null,
            risks: 0,
            name: "Unknown",
          };
          map.set(risk.projectId, { ...existing, risks: existing.risks + 1 });
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
