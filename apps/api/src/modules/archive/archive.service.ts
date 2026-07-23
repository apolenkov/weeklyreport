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

/**
 * Archive section visibility filter.
 *
 * Repository receives the requester's session (or the narrow Pick used by
 * tests) so it can spread `groupScopeFilter(session, 'reportSection')` into
 * the nested `sections.where` clause. The Report row itself stays globally
 * visible (still gated by PUBLISHED_FLOOR + ArchiveReadFilter) so the user
 * can browse the period list, but the assembled view only includes sections
 * the requester is allowed to read.
 */
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

/**
 * Translate the session role into the read filter.
 * Viewers MUST see only published reports — defense-in-depth on top of the
 * repository's existing hard floor (`status: 'published'`). For non-viewer
 * roles (head/lead/admin) and for `undefined` (legacy callers / no-role
 * scripts) the filter is empty — the repository's hardcoded floor still
 * keeps everyone on published rows, so widening here is safe.
 */
function buildArchiveReadFilter(role: Role | undefined): ArchiveReadFilter {
  if (role === "viewer") {
    return { status: "published" };
  }
  return {};
}

/**
 * Order an archive detail's sections by author name ascending. Pure — never
 * mutates the input array — so a viewer scanning the archived report finds
 * authors alphabetically rather than in whatever order the assembled report
 * happened to produce them.
 */
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
    // Pagination lives in the repository now: it pages at the database with a
    // stable `publishedAt desc, id desc` cursor and only reads the page plus
    // one probe row, instead of loading the whole archive to slice in memory.
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
