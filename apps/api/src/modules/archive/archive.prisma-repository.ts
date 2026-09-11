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
import {
  publishedReportScopeWhere,
  requirePublishedSnapshot,
  requireScopedPublishedSnapshot,
} from "../report-sections/index.js";
import type {
  ArchiveDetailRead,
  ArchiveReadFilter,
  ArchiveRepository,
  ArchiveScopeSession,
} from "./archive.service.js";
import { decodeArchiveCursor, encodeArchiveCursor } from "./archive-cursor.js";

// Hard floor: published + archived only; callers may narrow, never widen.
const PUBLISHED_FLOOR = { status: "published" as const, archived: true };

// Display sentinel when the frozen snapshot has no publisher name.
const UNKNOWN_PUBLISHER_NAME = "Unknown";
const DEFAULT_ARCHIVE_PAGE_SIZE = 20;

const archiveReportSelect = {
  id: true,
  publishedAt: true,
  publishedSnapshot: true,
} as const;

type ArchiveListRow = Prisma.ReportGetPayload<{
  select: typeof archiveReportSelect;
}>;

@Injectable()
export class ArchivePrismaRepository implements ArchiveRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  readonly listArchiveReports = async (
    pagination: PaginationInput | undefined,
    filter: ArchiveReadFilter | undefined,
    session: ArchiveScopeSession,
  ): Promise<PaginatedResult<ArchiveReportSummary>> => {
    const where = {
      ...filter,
      ...PUBLISHED_FLOOR,
      ...publishedReportScopeWhere(session),
    };
    const page = pagination ?? { limit: DEFAULT_ARCHIVE_PAGE_SIZE };

    // Page + one probe; content comes only from the stored publication snapshot.
    const rows = await this.fetchArchivePage(where, page);

    const { limit } = page;
    const hasNextPage = rows.length > limit;
    const pageRows = hasNextPage ? rows.slice(0, limit) : rows;

    const items = this.buildSummaries(pageRows, session);
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
    pagination: PaginationInput,
  ): Promise<ArchiveListRow[]> {
    const orderBy: Prisma.ReportOrderByWithRelationInput[] = [
      { publishedAt: "desc" },
      { id: "desc" },
    ];
    const { cursor, limit } = pagination;
    return this.prisma.report.findMany({
      where: cursor ? withArchiveKeyset(where, cursor) : where,
      select: archiveReportSelect,
      orderBy,
      take: limit + 1,
    });
  }

  private buildSummaries(
    rows: ArchiveListRow[],
    session: ArchiveScopeSession,
  ): ArchiveReportSummary[] {
    return rows.map((row) => {
      const assembled = readScopedSnapshot(row, session);
      return toArchiveSummaryFromSnapshot(assembled, row.id);
    });
  }

  readonly getArchiveReport = async (
    reportId: string,
    filter: ArchiveReadFilter | undefined,
    session: ArchiveScopeSession,
  ): Promise<ArchiveDetailRead> => {
    const report = await this.prisma.report.findFirst({
      where: {
        id: reportId,
        ...filter,
        ...PUBLISHED_FLOOR,
        ...publishedReportScopeWhere(session),
      },
      select: archiveReportSelect,
    });

    if (!report) {
      return { detail: null, totalSectionCount: 0 };
    }

    const snapshot = requirePublishedSnapshot(
      report.publishedSnapshot,
      report.id,
    );
    const assembled = requireScopedPublishedSnapshot(snapshot, session);
    // Summary and detail derive from the SAME assembled report, so the
    // portfolio total can never disagree with the detail (both risk-floored).
    const summary = toArchiveSummaryFromSnapshot(assembled, report.id);

    return {
      detail: archiveReportDetailSchema.parse({ summary, report: assembled }),
      totalSectionCount: snapshot.sections.length,
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

function toArchiveSummaryFromSnapshot(
  snapshot: AssembledReport,
  reportId: string,
): ArchiveReportSummary {
  if (snapshot.publishedAt === null) {
    throw new Error(
      `Archive report ${reportId} has publishedSnapshot but publishedAt is null`,
    );
  }

  return archiveReportSummarySchema.parse({
    reportId: snapshot.reportId,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    publishedAt: snapshot.publishedAt,
    publishedByName: snapshot.publishedByName ?? UNKNOWN_PUBLISHER_NAME,
    portfolioStatus: snapshot.portfolioOverview.status,
  });
}

function readScopedSnapshot(
  report: {
    id?: string;
    publishedSnapshot?: Prisma.JsonValue | null;
  },
  session: ArchiveScopeSession,
): AssembledReport {
  const snapshot = requirePublishedSnapshot(
    report.publishedSnapshot,
    report.id,
  );

  return requireScopedPublishedSnapshot(snapshot, session);
}
