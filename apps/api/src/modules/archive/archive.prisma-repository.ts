import {
  archiveReportDetailSchema,
  type ArchiveReportSummary,
  archiveReportSummarySchema,
  type AssembledReport,
  type PaginatedResult,
  type PaginationInput,
} from "@customreport/shared";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../../lib/group-scope.js";
import {
  buildAssembledReportFromPrismaRow,
  filterSnapshotSections,
  parsePublishedSnapshot,
} from "../published-report-snapshot.js";
import { reportSectionFullInclude } from "../report-sections/index.js";
import type {
  ArchiveDetailRead,
  ArchiveReadFilter,
  ArchiveRepository,
  ArchiveScopeSession,
} from "./archive.service.js";
import { decodeArchiveCursor, encodeArchiveCursor } from "./archive-cursor.js";

// Hard floor: published + archived only; callers may narrow, never widen.
const PUBLISHED_FLOOR = { status: "published" as const, archived: true };

// Display sentinel when snapshot and publisher name are both missing.
const UNKNOWN_PUBLISHER_NAME = "Unknown";
const DEFAULT_ARCHIVE_PAGE_SIZE = 20;

// The paginated list query loads section ids only (enough to scope the
// snapshot filter); the full nested graph is fetched lazily for fallback rows.
type ArchiveListRow = Prisma.ReportGetPayload<{
  include: {
    publishedBy: true;
    sections: { select: { id: true } };
  };
}>;

type ArchiveFullRow = Prisma.ReportGetPayload<{
  include: {
    publishedBy: true;
    sections: { include: typeof reportSectionFullInclude };
  };
}>;

@Injectable()
export class ArchivePrismaRepository implements ArchiveRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  readonly listArchiveReports = async (
    pagination: PaginationInput | undefined,
    filter: ArchiveReadFilter | undefined,
    session: ArchiveScopeSession,
  ): Promise<PaginatedResult<ArchiveReportSummary>> => {
    const sectionScope = sectionScopeWhere(session);
    const where = { ...filter, ...PUBLISHED_FLOOR };
    const page = pagination ?? { limit: DEFAULT_ARCHIVE_PAGE_SIZE };

    // Page + one probe; full graph loads only for snapshot-less fallback rows.
    const rows = await this.fetchArchivePage(where, sectionScope, page);

    const { limit } = page;
    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;

    const items = await this.buildSummaries(pageRows, sectionScope);
    const lastRow = hasNextPage ? pageRows.at(-1) : undefined;
    // Encode the last kept row's keyset coordinate so the next page resumes
    // even if this row is later unarchived or deleted.
    const nextCursor =
      lastRow && lastRow.publishedAt !== null
        ? encodeArchiveCursor(lastRow.publishedAt, lastRow.id)
        : null;

    return { items, nextCursor };
  };

  private fetchArchivePage(
    where: Prisma.ReportWhereInput,
    sectionScope: Record<string, unknown> | undefined,
    pagination: PaginationInput,
  ): Promise<ArchiveListRow[]> {
    const orderBy: Prisma.ReportOrderByWithRelationInput[] = [
      { publishedAt: "desc" },
      { id: "desc" },
    ];
    const include = {
      publishedBy: true,
      sections: {
        ...(sectionScope ? { where: sectionScope } : {}),
        select: { id: true },
      },
    } satisfies Prisma.ReportInclude;

    const { cursor, limit } = pagination;
    return this.prisma.report.findMany({
      where: cursor ? withArchiveKeyset(where, cursor) : where,
      include,
      orderBy,
      take: limit + 1,
    });
  }

  private async buildSummaries(
    rows: ArchiveListRow[],
    sectionScope: Record<string, unknown> | undefined,
  ): Promise<ArchiveReportSummary[]> {
    const fallbackIds = rows
      .filter((row) => !parsePublishedSnapshot(row.publishedSnapshot))
      .map((row) => row.id);
    const fullById = await this.loadFallbackGraphs(fallbackIds, sectionScope);

    return rows.map((row) => {
      const snapshot = readScopedSnapshot(row, sectionScope);
      const assembled =
        snapshot ??
        buildAssembledReportFromPrismaRow(requireFullRow(fullById, row.id));
      return toArchiveSummaryFromSnapshot(assembled, row);
    });
  }

  private async loadFallbackGraphs(
    ids: string[],
    sectionScope: Record<string, unknown> | undefined,
  ): Promise<Map<string, ArchiveFullRow>> {
    if (ids.length === 0) return new Map();
    // Fallback rebuilds the same risk-floored model as detail (totals must agree).
    const fullRows = await this.prisma.report.findMany({
      where: { id: { in: ids } },
      include: {
        publishedBy: true,
        sections: {
          ...(sectionScope ? { where: sectionScope } : {}),
          include: reportSectionFullInclude,
        },
      },
    });
    return new Map(fullRows.map((row) => [row.id, row]));
  }

  readonly getArchiveReport = async (
    reportId: string,
    filter: ArchiveReadFilter | undefined,
    session: ArchiveScopeSession,
  ): Promise<ArchiveDetailRead> => {
    // findFirst: status is non-unique so WhereUniqueInput cannot take it.
    const sectionScope = sectionScopeWhere(session);
    const report = await this.prisma.report.findFirst({
      where: { id: reportId, ...filter, ...PUBLISHED_FLOOR },
      include: {
        publishedBy: true,
        // Total (unscoped) section count lets the caller tell a genuinely
        // empty report apart from one the caller is scoped out of.
        _count: { select: { sections: true } },
        sections: {
          ...(sectionScope ? { where: sectionScope } : {}),
          include: reportSectionFullInclude,
        },
      },
    });

    if (!report) {
      return { detail: null, totalSectionCount: 0 };
    }

    const snapshot = readScopedSnapshot(report, sectionScope);
    const assembled = snapshot ?? buildAssembledReportFromPrismaRow(report);
    // Summary and detail derive from the SAME assembled report, so the
    // portfolio total can never disagree with the detail (both risk-floored).
    const summary = toArchiveSummaryFromSnapshot(assembled, report);

    return {
      detail: archiveReportDetailSchema.parse({ summary, report: assembled }),
      totalSectionCount: report._count.sections,
    };
  };
}

// Keyset after cursor on publishedAt desc, id desc; bad cursor → 400, not page 1.
function withArchiveKeyset(
  where: Prisma.ReportWhereInput,
  cursor: string,
): Prisma.ReportWhereInput {
  const decoded = decodeArchiveCursor(cursor);
  if (!decoded) {
    // A present cursor that fails to decode is a malformed / tampered token.
    // Fail loud (400) instead of silently restarting at page 1, which would
    // mask the bug and could loop a client that keeps resending it.
    throw new BadRequestException("Malformed archive pagination cursor.");
  }
  return {
    ...where,
    OR: [
      { publishedAt: { lt: decoded.publishedAt } },
      { publishedAt: decoded.publishedAt, id: { lt: decoded.id } },
    ],
  };
}

// undefined when no scope applies (admin / no granted groups).
function sectionScopeWhere(
  session: ArchiveScopeSession,
): Record<string, unknown> | undefined {
  const scope = groupScopeFilter(session, "reportSection");
  if (Object.keys(scope).length === 0) return undefined;
  return scope;
}

function requireFullRow(
  fullById: Map<string, ArchiveFullRow>,
  reportId: string,
): ArchiveFullRow {
  const row = fullById.get(reportId);
  if (!row) {
    throw new Error(
      `Archive report ${reportId} has no snapshot and no section graph was loaded`,
    );
  }
  return row;
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
      snapshot.publishedByName ??
      report.publishedBy?.name ??
      UNKNOWN_PUBLISHER_NAME,
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
