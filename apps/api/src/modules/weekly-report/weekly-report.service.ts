import type { WeeklyReportReadModel } from '@customreport/shared';

export class WeeklyReportDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeeklyReportDomainError';
  }
}

export interface WeeklyReportRepository {
  getWeeklyReport(reportId: string): Promise<WeeklyReportReadModel | null>;
  getActiveReportId(): Promise<string | null>;
}

export class WeeklyReportService {
  constructor(private readonly repository: WeeklyReportRepository) {}

  async getWeeklyReport(reportId?: string): Promise<WeeklyReportReadModel> {
    const resolvedId = reportId ?? (await this.repository.getActiveReportId());

    if (!resolvedId) {
      throw new WeeklyReportDomainError('No active report period found.');
    }

    const report = await this.repository.getWeeklyReport(resolvedId);

    if (!report) {
      throw new WeeklyReportDomainError(`Report ${resolvedId} not found.`);
    }

    return report;
  }
}
