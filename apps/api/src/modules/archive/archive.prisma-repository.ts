import {
  type ArchiveReportDetail,
  type ArchiveReportSummary,
  type AssembledReport,
  archiveReportDetailSchema,
  archiveReportSummarySchema,
  type PortfolioOverview,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../../lib/group-scope.js";
import {
  buildAssembledReportFromPrismaRow,
  filterSnapshotSections,
  parsePublishedSnapshot,
} from "../published-report-snapshot.js";
import { reportSectionFullInclude } from "../report-sections/report-sections.prisma-repository.js";
import type {
  ArchiveReadFilter,
  ArchiveRepository,
  ArchiveScopeSession,
} from "./archive.service.js";

/**
 * AUTH-04 (Phase 28-01): defense-in-depth status floor.
 *
 * The archive surface has always been "published reports only" — the
 * hardcoded floor below is the single source of truth for that contract.
 * The service-layer filter passed in via `ArchiveReadFilter` is allowed to
 * NARROW further (e.g. an explicit `status: 'published'` from a viewer role
 * is identical to the floor and a no-op) but cannot widen — the repo will
 * never return non-published rows even if a caller mis-built the filter.
 *
 * A22: `archived: true` added so the Archive tab only shows reports the head
 * has explicitly archived. Published-but-not-yet-archived reports remain on
 * the head dashboard until the head moves them to the archive.
 */
const PUBLISHED_FLOOR = { status: "published" as const, archived: true };

@Injectable()
export class ArchivePrismaRepository implements ArchiveRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listArchiveReports(
    filter?: ArchiveReadFilter,
    session?: ArchiveScopeSession,
  ): Promise<ArchiveReportSummary[]> {
    const sectionScope = sectionScopeWhere(session);
    const reports = await this.prisma.report.findMany({
      where: { ...PUBLISHED_FLOOR, ...(filter ?? {}) },
      include: {
        publishedBy: true,
        sections: {
          ...(sectionScope ? { where: sectionScope } : {}),
          include: {
            projectStatuses: true,
          },
        },
      },
      orderBy: { publishedAt: "desc" },
    });

    return reports.map((report) => {
      const snapshot = readScopedSnapshot(report, sectionScope);
      return snapshot
        ? toArchiveSummaryFromSnapshot(snapshot, report)
        : toArchiveSummary(report);
    });
  }

  async getArchiveReport(
    reportId: string,
    filter?: ArchiveReadFilter,
    session?: ArchiveScopeSession,
  ): Promise<ArchiveReportDetail | null> {
    // findFirst (not findUnique) because we compose `status` into the where
    // for defense-in-depth — Prisma's WhereUniqueInput rejects non-unique
    // fields. The id-equality on the unique PK still produces ≤1 row.
    const sectionScope = sectionScopeWhere(session);
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, ...PUBLISHED_FLOOR, ...(filter ?? {}) },
      include: {
        publishedBy: true,
        sections: {
          ...(sectionScope ? { where: sectionScope } : {}),
          include: reportSectionFullInclude,
        },
      },
    });

    if (!report) {
      return null;
    }

    const snapshot = readScopedSnapshot(report, sectionScope);
    const assembled = snapshot ?? buildAssembledReportFromPrismaRow(report);
    const summary = snapshot
      ? toArchiveSummaryFromSnapshot(snapshot, report)
      : toArchiveSummary(report);

    return archiveReportDetailSchema.parse({ summary, report: assembled });
  }
}

/**
 * UFB-040 / Phase 46-03: build the nested-sections where fragment from the
 * caller's session. Returns `undefined` when no scope filter applies (admin,
 * or no session passed at all — legacy callers / scripts).
 */
function sectionScopeWhere(
  session: ArchiveScopeSession | undefined,
): Record<string, unknown> | undefined {
  if (!session) return undefined;
  const scope = groupScopeFilter(
    session as Parameters<typeof groupScopeFilter>[0],
    "reportSection",
  );
  if (Object.keys(scope).length === 0) return undefined;
  return scope;
}

function computePortfolioOverview(
  // Prisma returns `status: TrafficLightStatus | null`; null statuses
  // contribute nothing to the totals.
  sections: { projectStatuses: { status: string | null }[] }[],
): PortfolioOverview {
  const totals = { green: 0, yellow: 0, red: 0 };

  for (const section of sections) {
    for (const ps of section.projectStatuses) {
      const status = ps.status as keyof typeof totals;

      if (status in totals) {
        totals[status]++;
      }
    }
  }

  const overallStatus: PortfolioOverview["status"] =
    totals.red > 0 ? "red" : totals.yellow > 0 ? "yellow" : "green";

  return { status: overallStatus, totals };
}

function toArchiveSummary(report: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  publishedAt: Date | null;
  publishedBy: { name: string } | null;
  sections: { projectStatuses: { status: string | null }[] }[];
}): ArchiveReportSummary {
  const portfolio = computePortfolioOverview(report.sections);

  // PUBLISHED_FLOOR guarantees `status: 'published'`, which in the schema
  // implies `publishedAt` is set. Narrow defensively rather than assert.
  if (report.publishedAt === null) {
    throw new Error(
      `Archive report ${report.id} has status='published' but publishedAt is null`,
    );
  }

  return archiveReportSummarySchema.parse({
    reportId: report.id,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    publishedAt: report.publishedAt,
    publishedByName: report.publishedBy?.name ?? "Unknown",
    portfolioStatus: portfolio.status,
  });
}

function toArchiveSummaryFromSnapshot(
  snapshot: AssembledReport,
  report: { id: string; publishedBy: { name: string } | null },
): ArchiveReportSummary {
  if (snapshot.publishedAt === null) {
    throw new Error(
      `Archive report ${report.id} has publishedSnapshot but publishedAt is null`,
    );
  }

  return archiveReportSummarySchema.parse({
    reportId: snapshot.reportId,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    publishedAt: snapshot.publishedAt,
    publishedByName:
      snapshot.publishedByName ?? report.publishedBy?.name ?? "Unknown",
    portfolioStatus: snapshot.portfolioOverview.status,
  });
}

function readScopedSnapshot(
  report: {
    publishedSnapshot?: Prisma.JsonValue | null;
    sections: { id: string }[];
  },
  sectionScope: Record<string, unknown> | undefined,
): AssembledReport | null {
  const snapshot = parsePublishedSnapshot(report.publishedSnapshot);
  if (!snapshot) return null;

  if (!sectionScope) return snapshot;

  return filterSnapshotSections(
    snapshot,
    new Set(report.sections.map((section) => section.id)),
  );
}
