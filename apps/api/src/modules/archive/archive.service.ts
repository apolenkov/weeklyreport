import type { ReportStatus } from "@customreport/shared";
import {
  type ArchiveReportDetail,
  archiveReportDetailSchema,
  type ArchiveReportSummary,
  archiveReportSummarySchema,
  type PaginatedResult,
  type PaginationInput,
  type UserSession,
} from "@customreport/shared";

import { guardGroupScope } from "../../lib/group-scope.js";

export class ArchiveDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveDomainError";
  }
}

// Role-aware filter as a plain object the repository merges into its Prisma
// `where`, so domain code stays free of `@prisma/client`. `status` optional.
export interface ArchiveReadFilter {
  readonly status?: ReportStatus;
}

// Session pick for section-level group scope; Report rows stay floor-gated.
export type ArchiveScopeSession = Pick<
  UserSession,
  "role" | "reportingGroupId" | "viewerGroupAccess"
>;

// Detail read carries the total (unscoped) section count so callers can
// distinguish a genuinely empty report from one the caller is scoped out of.
export interface ArchiveDetailRead {
  readonly detail: ArchiveReportDetail | null;
  readonly totalSectionCount: number;
}

export interface ArchiveRepository {
  readonly listArchiveReports: (
    pagination: PaginationInput | undefined,
    filter: ArchiveReadFilter | undefined,
    session: ArchiveScopeSession,
  ) => Promise<{
    readonly items: readonly ArchiveReportSummary[];
    readonly nextCursor: string | null;
  }>;
  readonly getArchiveReport: (
    reportId: string,
    filter: ArchiveReadFilter | undefined,
    session: ArchiveScopeSession,
  ) => Promise<ArchiveDetailRead>;
}

// Viewer-only status filter; other roles rely on the repository floor.
// The scope session is mandatory — an absent session must be a hard error
// (fail closed), never a permissive no-scope read.
function buildArchiveReadFilter(
  session: ArchiveScopeSession,
): ArchiveReadFilter {
  if (session.role === "viewer") {
    return { status: "published" };
  }
  return {};
}

function sortSectionsByAuthorName(
  detail: ArchiveReportDetail,
): ArchiveReportDetail {
  return {
    ...detail,
    report: {
      ...detail.report,
      sections: [...detail.report.sections].sort((a, b) =>
        a.authorName.localeCompare(b.authorName),
      ),
    },
  };
}

export class ArchiveService {
  constructor(private readonly repository: ArchiveRepository) {}

  async listArchiveReports(
    pagination: PaginationInput | undefined,
    session: ArchiveScopeSession,
  ): Promise<PaginatedResult<ArchiveReportSummary>> {
    guardGroupScope(session);
    const filter = buildArchiveReadFilter(session);
    const page = await this.repository.listArchiveReports(
      pagination,
      filter,
      session,
    );
    return {
      items: archiveReportSummarySchema.array().parse(page.items),
      nextCursor: page.nextCursor,
    };
  }

  async getArchiveReport(
    reportId: string,
    session: ArchiveScopeSession,
  ): Promise<{ detail: ArchiveReportDetail; totalSectionCount: number }> {
    guardGroupScope(session);
    const filter = buildArchiveReadFilter(session);
    const result = await this.repository.getArchiveReport(
      reportId,
      filter,
      session,
    );

    if (!result.detail) {
      throw new ArchiveDomainError(`Archive report ${reportId} was not found.`);
    }

    return {
      detail: archiveReportDetailSchema.parse(
        sortSectionsByAuthorName(result.detail),
      ),
      totalSectionCount: result.totalSectionCount,
    };
  }
}
