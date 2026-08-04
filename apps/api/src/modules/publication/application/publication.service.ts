import {
  type AssembledReport,
  assembledReportSchema,
  type PortfolioOverview,
  type ReportSectionReadModel,
} from "@customreport/shared";

import type { AppLogger } from "../../../lib/logger";
import {
  emitPublishSideEffects,
  type IngestionPublishHook,
} from "../../period/index.js";
import {
  NOOP_PUBLICATION_TELEMETRY,
  type PublicationTelemetry,
} from "./publication-telemetry.port.js";

// Thrown by `getAssembledReport` when the requested report row is absent. Its
// in-service caller (`publishAuto`) propagates it, so a missing report surfaces
// as NOT_FOUND instead of a false 500.
export class PublicationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicationNotFoundError";
  }
}

// Both discriminants are explicit because `AssembledReport` exposes neither
// `archived` nor whether this call did the write: a skip and a report someone
// else published are indistinguishable from the returned report alone.
export type AutoPublishResult =
  | {
      readonly published: true;
      readonly report: AssembledReport;
      readonly wasAlreadyPublished: boolean;
    }
  | { readonly published: false };

export interface PublicationRepository {
  getAssembledReport(activeReportId: string): Promise<AssembledReport | null>;
  // Compare-and-set: writes only while the row is still `status="draft"` and
  // `archived=false`. A zero-row match writes nothing and returns
  // `{ published: false }`.
  saveAutoPublishedReport(report: AssembledReport): Promise<AutoPublishResult>;
}

// DI token binding the PublicationRepository port to its adapter at the module
// boundary — the service depends on the port, not the concrete prisma class.
export const PUBLICATION_REPOSITORY = Symbol("PublicationRepository");

export interface PublicationIngestionQueue {
  enqueue: IngestionPublishHook;
}

// Explicit dev-only no-op: publication-time ingestion is deferred, so this seam
// must never be silent. Every enqueue logs a loud warning, and production
// composition refuses to wire it until a real queue consumer is supplied.
export class NoopIngestionQueue implements PublicationIngestionQueue {
  constructor(
    private readonly logger: AppLogger,
    nodeEnv: string,
  ) {
    if (nodeEnv === "production") {
      throw new Error(
        "Publication-time ingestion is not wired; a real ingestion consumer is required in production (see TODO(ingestion-consumer)).",
      );
    }
  }

  enqueue(sectionIds: readonly string[]): Promise<void> {
    this.logger.warn(
      "ingestion is a no-op: no queue consumer wired; publication-time ingestion skipped",
      { sectionIds: sectionIds.length },
    );
    return Promise.resolve();
  }
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

// Display name shown in the UI for a report the auto-publish cron closed
// with no human head to attribute it to.
const SYSTEM_PUBLISHER_NAME = "system";

function deriveAutoPublishedReport(
  report: AssembledReport,
  publishAt: Date,
): AssembledReport {
  return assembledReportSchema.parse({
    ...report,
    status: "published",
    publishedAt: publishAt,
    publishedById: null,
    publishedByName: SYSTEM_PUBLISHER_NAME,
  });
}

export class PublicationService {
  constructor(
    private readonly repository: PublicationRepository,
    private readonly logger: AppLogger,
    private readonly ingestionQueue: PublicationIngestionQueue,
    private readonly invalidateAnalyticsCache: () => Promise<void>,
    private readonly telemetry: PublicationTelemetry = NOOP_PUBLICATION_TELEMETRY,
  ) {}

  async getAssembledReport(activeReportId: string): Promise<AssembledReport> {
    const report = await this.repository.getAssembledReport(activeReportId);

    if (!report) {
      throw new PublicationNotFoundError(
        `Report ${activeReportId} was not found.`,
      );
    }

    const sortedSections = [...report.sections].sort(compareSections);

    return assembledReportSchema.parse({
      ...report,
      portfolioOverview: buildPortfolioOverview(sortedSections),
      sections: sortedSections,
    });
  }

  // Scheduler-driven: no human actor, so `publishedById=null`. A head who
  // published the same report between candidate selection and this call lands
  // on `wasAlreadyPublished: true` — never counted as auto in audit trails.
  async publishAuto(
    activeReportId: string,
    publishAt: Date,
  ): Promise<AutoPublishResult> {
    const report = await this.getAssembledReport(activeReportId);

    if (report.status === "published") {
      return { published: true, report, wasAlreadyPublished: true };
    }

    this.logger.info("auto-publishing report", { activeReportId });
    const result = await this.repository.saveAutoPublishedReport(
      deriveAutoPublishedReport(report, publishAt),
    );

    if (!result.published) {
      // Compare-and-set matched zero rows: the period was archived (or already
      // published) after candidate selection. Expected no-op — emit no metrics,
      // invalidate no cache, and enqueue no ingestion.
      this.logger.info("auto-publish skipped: archived after selection", {
        activeReportId,
      });
      return { published: false };
    }

    // A scheduler candidate is always `status='draft'` with `periodStatus='open'`
    // (never reopened) — `state='published'`, `from='open'`. Emit only after the
    // write succeeds so a failed save never inflates the counter.
    await emitPublishSideEffects(
      {
        telemetry: this.telemetry,
        ingestionHook: (sectionIds) => this.ingestionQueue.enqueue(sectionIds),
        invalidateAnalyticsCache: this.invalidateAnalyticsCache,
        onSideEffectError: (error) => {
          this.logger.warn("publish side-effect failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        },
        onIngestionError: (error) => {
          this.logger.warn("ingestion hook failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        },
        // Skip ingestion when the report has zero sections.
        skipIngestionWhenEmpty: true,
      },
      {
        priorStatus: "open",
        getSectionIds: () =>
          result.report.sections.map((s) => s.reportSectionId),
      },
    );
    return {
      published: true,
      report: result.report,
      wasAlreadyPublished: result.wasAlreadyPublished,
    };
  }
}
