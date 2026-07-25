import type { ReportStatus } from "@customreport/shared";
import {
  type ArchiveReportDetail,
  archiveReportDetailSchema,
  type ArchiveReportSummary,
  archiveReportSummarySchema,
  type PaginatedResult,
  type PaginationInput,
  type Role,
  type UserSession,
} from "@customreport/shared";

export class ArchiveDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveDomainError";
  }
}

/**
 * Role-aware filter expressed as a plain object the repository merges into
 * its Prisma `where`, so domain code stays free of `@prisma/client`.
 * `status` is optional: omit it for no status predicate.
 */
export interface ArchiveReadFilter {
  status?: ReportStatus;
}

// Session pick for section-level group scope; Report rows stay floor-gated.
export type ArchiveScopeSession = Pick<
  UserSession,
  "role" | "reportingGroupId" | "viewerGroupAccess"
>;

export interface ArchiveRepository {
  listArchiveReports(
    pagination?: PaginationInput,
    filter?: ArchiveReadFilter,
    session?: ArchiveScopeSession,
  ): Promise<PaginatedResult<ArchiveReportSummary>>;
  getArchiveReport(
    reportId: string,
    filter?: ArchiveReadFilter,
    session?: ArchiveScopeSession,
  ): Promise<ArchiveReportDetail | null>;
}

// Viewer-only status filter; other roles rely on the repository floor.
function buildArchiveReadFilter(role: Role | undefined): ArchiveReadFilter {
  if (role === "viewer") {
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
    pagination?: PaginationInput,
    role?: Role,
    session?: ArchiveScopeSession,
  ): Promise<PaginatedResult<ArchiveReportSummary>> {
    const filter = buildArchiveReadFilter(role);
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
    role?: Role,
    session?: ArchiveScopeSession,
  ): Promise<ArchiveReportDetail> {
    const filter = buildArchiveReadFilter(role);
    const detail = await this.repository.getArchiveReport(
      reportId,
      filter,
      session,
    );

    if (!detail) {
      throw new ArchiveDomainError(`Archive report ${reportId} was not found.`);
    }

    return archiveReportDetailSchema.parse(sortSectionsByAuthorName(detail));
  }
}
