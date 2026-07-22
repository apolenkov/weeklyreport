import {
  type ArchiveReportDetail,
  archiveReportDetailSchema,
  type ArchiveReportSummary,
  archiveReportSummarySchema,
  type AssembledReport,
  type PaginatedResult,
  type PaginationInput,
} from "@customreport/shared";
import { BadRequestException, Injectable } from "@nestjs/common";
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
  ArchiveReadFilter,
  ArchiveRepository,
  ArchiveScopeSession,
} from "./archive.service.js";
import { decodeArchiveCursor, encodeArchiveCursor } from "./archive-cursor.js";

/**
 * Defense-in-depth status floor.
 *
 * The archive surface has always been "published reports only" — the
 * hardcoded floor below is the single source of truth for that contract.
 * The service-layer filter passed in via `ArchiveReadFilter` is allowed to
 * NARROW further (e.g. an explicit `status: 'published'` from a viewer role
 * is identical to the floor and a no-op) but cannot widen — the repo will
 * never return non-published rows even if a caller mis-built the filter.
 *
 * `archived: true` so the Archive tab only shows reports the head has
 * explicitly archived. Published-but-not-yet-archived reports remain on
 * the head dashboard until the head moves them to the archive.
 */
const PUBLISHED_FLOOR = { status: "published" as const, archived: true };

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
  constructor(private readonly prisma: PrismaService) {}

  async listArchiveReports(
    pagination?: PaginationInput,
    filter?: ArchiveReadFilter,
    session?: ArchiveScopeSession,
  ): Promise<PaginatedResult<ArchiveReportSummary>> {
    const sectionScope = sectionScopeWhere(session);
    const where = { ...filter, ...PUBLISHED_FLOOR };

    // Fetch section ids only — enough to scope the snapshot filter — plus one
    // probe row beyond the page so we can tell whether a further page exists
    // without re-reading the whole archive. The heavy nested section graph is
    // loaded lazily below, only for the snapshot-less fallback rows.
    const rows = await this.fetchArchivePage(where, sectionScope, pagination);

    const limit = pagination?.limit;
    const hasNextPage = limit !== undefined && rows.length > limit;
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
  }

  private fetchArchivePage(
    where: Prisma.ReportWhereInput,
    sectionScope: Record<string, unknown> | undefined,
    pagination: PaginationInput | undefined,
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

    if (!pagination) {
      return this.prisma.report.findMany({ where, include, orderBy });
    }

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
    // Full include only for the snapshot-less rows: the fallback path rebuilds
    // the same risk-floored, assignment-scoped read model the detail uses, so
    // an archive summary's portfolio total never disagrees with its detail.
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
      where: { id: reportId, ...filter, ...PUBLISHED_FLOOR },
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
    // Summary and detail derive from the SAME assembled report, so the
    // portfolio total can never disagree with the detail (both risk-floored).
    const summary = toArchiveSummaryFromSnapshot(assembled, report);

    return archiveReportDetailSchema.parse({ summary, report: assembled });
  }
}

/**
 * Narrow the archive `where` to rows strictly after the cursor coordinate,
 * matching the `publishedAt desc, id desc` order exactly so pagination neither
 * skips nor duplicates a row across the tie. A cursor that fails to decode
 * throws `BadRequestException` (400) — it never falls back to an unnarrowed,
 * first-page `where`.
 */
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

/**
 * Build the nested-sections where fragment from the
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
