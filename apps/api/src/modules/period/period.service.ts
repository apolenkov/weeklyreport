import { type UserSession } from '@customreport/shared';

export class PeriodAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PeriodAccessError';
  }
}

export interface PeriodRepository {
  getReportById(
    reportId: string,
  ): Promise<{
    id: string;
    status: string;
    periodStatus: string;
    publishedAt: Date | null;
  } | null>;
  publishPeriod(reportId: string, userId: string): Promise<void>;
  reopenPeriod(reportId: string): Promise<void>;
}

/**
 * Phase 30-01 (ANAL-01): the cache invalidation port. PeriodService stays
 * Redis-free; the AnalyticsCache is wired through this lambda by
 * period.module.ts. Default no-op keeps existing unit tests green.
 */
export type AnalyticsCacheInvalidator = () => Promise<void>;

export class PeriodService {
  constructor(
    private readonly repository: PeriodRepository,
    private readonly invalidateAnalyticsCache: AnalyticsCacheInvalidator = async () => undefined,
  ) {}

  async publishPeriod(
    reportId: string,
    session: UserSession,
  ): Promise<{ success: true; reportId: string }> {
    const report = await this.repository.getReportById(reportId);

    if (!report) {
      throw new Error(`Report ${reportId} not found.`);
    }

    if (report.periodStatus === 'published') {
      throw new PeriodAccessError('Period is already published.');
    }

    await this.repository.publishPeriod(reportId, session.userId);
    await this.invalidateAnalyticsCache();

    return { success: true, reportId };
  }

  async reopenPeriod(
    reportId: string,
  ): Promise<{ success: true; reportId: string }> {
    const report = await this.repository.getReportById(reportId);

    if (!report) {
      throw new Error(`Report ${reportId} not found.`);
    }

    if (report.periodStatus !== 'published') {
      throw new PeriodAccessError(
        'Only published periods can be reopened.',
      );
    }

    await this.repository.reopenPeriod(reportId);
    await this.invalidateAnalyticsCache();

    return { success: true, reportId };
  }
}
