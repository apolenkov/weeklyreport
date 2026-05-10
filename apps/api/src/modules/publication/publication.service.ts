import {
  draftSaveSchema,
  assembledReportSchema,
  type AssembledReport,
  type DraftSavePayload,
  type PortfolioOverview,
  type ReportSectionReadModel,
  type UserSession,
} from '@customreport/shared';

import { createNullLogger, type AppLogger } from '../../lib/logger';

export class PublicationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicationAccessError';
  }
}

export interface PublicationRepository {
  getAssembledReport(activeReportId: string): Promise<AssembledReport | null>;
  saveAssembledReport(report: AssembledReport): Promise<AssembledReport>;
}

function compareSections(
  left: ReportSectionReadModel,
  right: ReportSectionReadModel,
): number {
  return left.authorName.localeCompare(right.authorName, 'ru');
}

function buildPortfolioOverview(sections: ReportSectionReadModel[]): PortfolioOverview {
  const totals = sections.reduce(
    (summary, section) => {
      return section.projects.reduce((projectSummary, project) => {
        if (!project.trafficLight) {
          return projectSummary;
        }

        return {
          ...projectSummary,
          [project.trafficLight]: projectSummary[project.trafficLight] + 1,
        };
      }, summary);
    },
    {
      green: 0,
      yellow: 0,
      red: 0,
    },
  );

  const status =
    totals.red > 0 ? 'red' : totals.yellow > 0 ? 'yellow' : 'green';

  return {
    status,
    totals,
  };
}

export class PublicationService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: PublicationRepository,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  async getAssembledReport(activeReportId: string): Promise<AssembledReport> {
    const report = await this.repository.getAssembledReport(activeReportId);

    if (!report) {
      throw new Error(`Report ${activeReportId} was not found.`);
    }

    const sortedSections = [...report.sections].sort(compareSections);

    return assembledReportSchema.parse({
      ...report,
      portfolioOverview: buildPortfolioOverview(sortedSections),
      sections: sortedSections,
    });
  }

  async updateSectionForReview(
    activeReportId: string,
    input: DraftSavePayload,
  ): Promise<AssembledReport> {
    const parsedInput = draftSaveSchema.parse(input);
    const report = await this.getAssembledReport(activeReportId);

    if (report.status === 'published') {
      throw new PublicationAccessError('Published reports are immutable.');
    }

    const nextSections = report.sections.map((section) => {
      if (section.reportSectionId !== parsedInput.reportSectionId) {
        return section;
      }

      return {
        ...section,
        projects: section.projects.map((project) => ({
          ...project,
          trafficLight:
            parsedInput.projectStatuses.find((status) => status.projectId === project.projectId)
              ?.status ?? null,
        })),
        items: parsedInput.items,
        risks: parsedInput.risks,
        decisions: parsedInput.decisions,
        priorities: parsedInput.priorities,
      };
    });

    return this.repository.saveAssembledReport(
      assembledReportSchema.parse({
        ...report,
        portfolioOverview: buildPortfolioOverview(nextSections),
        sections: nextSections,
      }),
    );
  }

  async publishReport(
    activeReportId: string,
    session: UserSession,
  ): Promise<AssembledReport> {
    const report = await this.getAssembledReport(activeReportId);

    if (report.status === 'published') {
      throw new PublicationAccessError('Report has already been published.');
    }

    this.logger.info('publishing report', { activeReportId, userId: session.userId });
    return this.repository.saveAssembledReport(
      assembledReportSchema.parse({
        ...report,
        status: 'published',
        publishedAt: new Date(),
        publishedById: session.userId,
        publishedByName: session.name,
      }),
    );
  }

  /**
   * UFB-049 / Phase 50-B: scheduler-driven auto-publish. Same effect as
   * {@link publishReport} but no human actor — `publishedById=null` and
   * `publishedByName='system'`. Idempotent: re-publishing an already-
   * published report returns the existing AssembledReport without writing
   * (the autopublish scheduler queries `status='draft'`, so this branch
   * is defense-in-depth against a race where two ticks dispatch
   * concurrently).
   *
   * Missing sections are NOT auto-stubbed in the DB — they render as
   * "Не сдал" at read time from the head dashboard. This keeps the
   * write path narrow and avoids polluting history with empty sections.
   */
  async publishAuto(activeReportId: string): Promise<AssembledReport> {
    const report = await this.getAssembledReport(activeReportId);

    if (report.status === 'published') {
      // Idempotent: return the existing assembled report so the scheduler
      // can treat a race as a no-op without ad-hoc try/catch.
      return report;
    }

    this.logger.info('auto-publishing report', { activeReportId });
    return this.repository.saveAssembledReport(
      assembledReportSchema.parse({
        ...report,
        status: 'published',
        publishedAt: new Date(),
        publishedById: null,
        publishedByName: 'system',
      }),
    );
  }
}
