import {
  archiveReportDetailSchema,
  archiveReportSummarySchema,
  type ArchiveReportDetail,
  type ArchiveReportSummary,
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

  async listArchiveReports(): Promise<ArchiveReportSummary[]> {
    const reports = archiveReportSummarySchema.array().parse(
      await this.repository.listArchiveReports(),
    );

    return [...reports].sort(
      (left, right) => right.publishedAt.getTime() - left.publishedAt.getTime(),
    );
  }

  async getArchiveReport(reportId: string): Promise<ArchiveReportDetail> {
    const detail = await this.repository.getArchiveReport(reportId);

    if (!detail) {
      throw new ArchiveDomainError(`Archive report ${reportId} was not found.`);
    }

    return archiveReportDetailSchema.parse(detail);
  }
}
