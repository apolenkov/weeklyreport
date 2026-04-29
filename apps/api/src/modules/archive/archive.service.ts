import {
  archiveReportDetailSchema,
  archiveReportSummarySchema,
  type ArchiveReportDetail,
  type ArchiveReportSummary,
  type PaginationInput,
  type PaginatedResult,
  type Role,
} from '@customreport/shared';

export class ArchiveDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveDomainError';
  }
}

/**
 * AUTH-04 (Phase 28-01): the role-aware filter expressed as a plain object
 * the repository merges into its Prisma `where`. This shape stays Prisma-free
 * at the service layer so the domain code does not import `@prisma/client`.
 *
 * Mirrors the ReportStatus enum (Prisma) — narrow to the two members the
 * archive surface ever cares about: 'published' (default for viewer scope)
 * and 'draft' (in-progress).
 */
export interface ArchiveReadFilter {
  status?: 'draft' | 'published';
}

export interface ArchiveRepository {
  listArchiveReports(filter?: ArchiveReadFilter): Promise<ArchiveReportSummary[]>;
  getArchiveReport(
    reportId: string,
    filter?: ArchiveReadFilter,
  ): Promise<ArchiveReportDetail | null>;
}

/**
 * AUTH-04 (Phase 28-01): translate the session role into the read filter.
 * Viewers MUST see only published reports — defense-in-depth on top of the
 * repository's existing hard floor (`status: 'published'`). For non-viewer
 * roles (head/lead/admin) and for `undefined` (legacy callers / no-role
 * scripts) the filter is empty — the repository's hardcoded floor still
 * keeps everyone on published rows, so widening here is safe.
 */
export function buildArchiveReadFilter(role: Role | undefined): ArchiveReadFilter {
  if (role === 'viewer') {
    return { status: 'published' };
  }
  return {};
}

export class ArchiveService {
  constructor(private readonly repository: ArchiveRepository) {}

  async listArchiveReports(
    pagination?: PaginationInput,
    role?: Role,
  ): Promise<PaginatedResult<ArchiveReportSummary>> {
    const filter = buildArchiveReadFilter(role);
    const reports = archiveReportSummarySchema.array().parse(
      await this.repository.listArchiveReports(filter),
    );

    const sorted = [...reports].sort(
      (left, right) => right.publishedAt.getTime() - left.publishedAt.getTime(),
    );

    if (!pagination) {
      return { items: sorted, nextCursor: null };
    }

    const limit = pagination.limit ?? 20;
    const startIndex = pagination.cursor
      ? sorted.findIndex((r) => r.reportId === pagination.cursor) + 1
      : 0;
    const page = sorted.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < sorted.length
      ? sorted[startIndex + limit - 1]!.reportId
      : null;

    return { items: page, nextCursor };
  }

  async getArchiveReport(reportId: string, role?: Role): Promise<ArchiveReportDetail> {
    const filter = buildArchiveReadFilter(role);
    const detail = await this.repository.getArchiveReport(reportId, filter);

    if (!detail) {
      throw new ArchiveDomainError(`Archive report ${reportId} was not found.`);
    }

    return archiveReportDetailSchema.parse(detail);
  }
}
