import {
  archiveReportDetailSchema,
  archiveReportSummarySchema,
  type ArchiveReportDetail,
  type ArchiveReportSummary,
  type PaginationInput,
  type PaginatedResult,
} from '@customreport/shared';

export class ArchiveDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArchiveDomainError';
  }
}

export interface ArchiveRepository {
  listArchiveReports(): Promise<ArchiveReportSummary[]>;
  getArchiveReport(reportId: string): Promise<ArchiveReportDetail | null>;
}

export class ArchiveService {
  constructor(private readonly repository: ArchiveRepository) {}

  async listArchiveReports(
    pagination?: PaginationInput,
  ): Promise<PaginatedResult<ArchiveReportSummary>> {
    const reports = archiveReportSummarySchema.array().parse(
      await this.repository.listArchiveReports(),
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

  async getArchiveReport(reportId: string): Promise<ArchiveReportDetail> {
    const detail = await this.repository.getArchiveReport(reportId);

    if (!detail) {
      throw new ArchiveDomainError(`Archive report ${reportId} was not found.`);
    }

    return archiveReportDetailSchema.parse(detail);
  }
}
