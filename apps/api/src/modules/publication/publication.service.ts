import {
  draftSaveSchema,
  assembledReportSchema,
  type AssembledReport,
  type DraftSavePayload,
  type PortfolioOverview,
  type ReportSectionReadModel,
  type UserSession,
} from "@customreport/shared";

import { createNullLogger, type AppLogger } from "../../lib/logger";
import {
  customreportPeriodStateTransitionsTotal,
  customreportReportsSubmittedTotal,
} from "../../infrastructure/metrics/metrics.registry.js";

/**
 * Phase 54 (UFB-055): fire-and-forget ingestion seam. Wired by
 * PublicationModule to {@link AiIngestionService.enqueueSections};
 * unit tests default to a no-op so the 200+ existing tests stay green.
 * Errors thrown by the port are swallowed by the publish path — the
 * publish must succeed even when the future RAG pipeline is degraded.
 */
export type AiIngestionPublishHook = (
  sectionIds: readonly string[],
) => Promise<void>;

export class PublicationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicationAccessError";
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
  return left.authorName.localeCompare(right.authorName, "ru");
}

function buildPortfolioOverview(
  sections: ReportSectionReadModel[],
): PortfolioOverview {
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
    totals.red > 0 ? "red" : totals.yellow > 0 ? "yellow" : "green";

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
    /**
     * Phase 54 (UFB-055): on every successful publish, called with the
     * list of section ids that just landed in the published report.
     * Defaults to a no-op so existing tests / fixtures stay green.
     * Errors are swallowed below — publish never fails because of
     * ingestion bookkeeping.
     */
    private readonly ingestionHook: AiIngestionPublishHook = async () =>
      undefined,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  /**
   * Phase 54 (UFB-055): private helper — invokes the ingestion hook
   * with every section id in the assembled report and swallows any
   * error so the calling publish path always returns the report.
   */
  private async enqueueIngestion(report: AssembledReport): Promise<void> {
    const ids = report.sections.map((s) => s.reportSectionId);
    if (ids.length === 0) return;
    try {
      await this.ingestionHook(ids);
    } catch (err) {
      this.logger.warn("ai ingestion hook failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
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

    if (report.status === "published") {
      throw new PublicationAccessError("Published reports are immutable.");
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
            parsedInput.projectStatuses.find(
              (status) => status.projectId === project.projectId,
            )?.status ?? null,
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

    if (report.status === "published") {
      throw new PublicationAccessError("Report has already been published.");
    }

    this.logger.info("publishing report", {
      activeReportId,
      userId: session.userId,
    });
    const saved = await this.repository.saveAssembledReport(
      assembledReportSchema.parse({
        ...report,
        status: "published",
        publishedAt: new Date(),
        publishedById: session.userId,
        publishedByName: session.name,
      }),
    );
    // Phase 52-A: product telemetry. Emit only after the write succeeds —
    // a failed save would otherwise inflate the counter and corrupt the
    // on-time ratio numerator at the next gauge scrape.
    customreportReportsSubmittedTotal.inc({ state: "published" });
    customreportPeriodStateTransitionsTotal.inc({
      from: "open",
      to: "published",
    });
    // Phase 54 (UFB-055): enqueue ingestion AFTER metrics are emitted —
    // an ingestion failure must never block telemetry or the response.
    await this.enqueueIngestion(saved);
    return saved;
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

    if (report.status === "published") {
      // Idempotent: return the existing assembled report so the scheduler
      // can treat a race as a no-op without ad-hoc try/catch.
      return report;
    }

    this.logger.info("auto-publishing report", { activeReportId });
    const saved = await this.repository.saveAssembledReport(
      assembledReportSchema.parse({
        ...report,
        status: "published",
        publishedAt: new Date(),
        publishedById: null,
        publishedByName: "system",
      }),
    );
    // Phase 52-A: same telemetry as publishReport. Same `state` label so
    // ops can aggregate without `or` predicates — the manual-vs-auto
    // distinction is recovered by the period_state_transitions_total
    // panel paired with publishedById nullness.
    customreportReportsSubmittedTotal.inc({ state: "published" });
    customreportPeriodStateTransitionsTotal.inc({
      from: "open",
      to: "published",
    });
    // Phase 54 (UFB-055): mirror of publishReport — fire-and-forget
    // ingestion enqueue. Scheduler-driven auto-publishes feed the same
    // queue so the worker sees both manual and scheduled outputs.
    await this.enqueueIngestion(saved);
    return saved;
  }
}
