import {
  type AssembledReport,
  assembledReportSchema,
  type PortfolioOverview,
  type ReportSectionReadModel,
} from "@customreport/shared";

import { type AppLogger, createNullLogger } from "../../../lib/logger";
import {
  emitPublishSideEffects,
  type IngestionPublishHook,
} from "../../period/index.js";
import {
  NOOP_PUBLICATION_TELEMETRY,
  type PublicationTelemetry,
} from "./publication-telemetry.port.js";

/**
 * Thrown by `getAssembledReport` when the requested report row is absent. Its
 * in-service caller (`publishAuto`) propagates it, so a missing report
 * surfaces as NOT_FOUND instead of a false 500.
 */
export class PublicationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicationNotFoundError";
  }
}

/**
 * Outcome of an auto-publish attempt. The skip cannot be inferred from a
 * returned report — `AssembledReport` carries `status` but neither `archived`
 * nor `periodState` — so a period archived between candidate selection and the
 * guarded write must be signalled explicitly as `{ published: false }` rather
 * than derived from the report's shape.
 */
export type AutoPublishResult =
  | { readonly published: true; readonly report: AssembledReport }
  | { readonly published: false };

export interface PublicationRepository {
  getAssembledReport(activeReportId: string): Promise<AssembledReport | null>;
  /**
   * Persist a scheduler-driven auto-publish via the `autoPublish` transition,
   * guarded by a compare-and-set that only writes when the target row is still
   * `status="draft"` and `archived=false`. A zero-row match (the period was
   * archived or already published after candidate selection) writes nothing and
   * returns `{ published: false }`.
   */
  saveAutoPublishedReport(report: AssembledReport): Promise<AutoPublishResult>;
}

// DI token binding the PublicationRepository port to its adapter at the module
// boundary — the service depends on the port, not the concrete prisma class.
export const PUBLICATION_REPOSITORY = Symbol("PublicationRepository");

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
     * On every successful publish, called with the list of section ids
     * that just landed in the published report.
     * Defaults to a no-op so existing tests / fixtures stay green.
     * Errors are swallowed below — publish never fails because of
     * ingestion bookkeeping.
     */
    private readonly ingestionHook: IngestionPublishHook = () =>
      Promise.resolve(undefined),
    private readonly telemetry: PublicationTelemetry = NOOP_PUBLICATION_TELEMETRY,
  ) {
    this.logger = logger ?? createNullLogger();
  }

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

  /**
   * Scheduler-driven auto-publish. No human actor — `publishedById=null` and
   * `publishedByName='system'`.
   *
   * Returns a discriminated outcome, not the bare report: the underlying write
   * is a compare-and-set guarded on the row still being `status="draft"` and
   * `archived=false`, so a period archived between the scheduler's candidate
   * selection and this write matches zero rows and is SKIPPED. The skip is
   * signalled as `{ published: false }` (it cannot be inferred from a re-read —
   * `AssembledReport` exposes neither `archived` nor `periodState`), and the
   * publish success side-effects below — KPI metrics and ingestion enqueue —
   * fire only on the published branch. The scheduler suppresses its own
   * side-effects (audit, missing-section count, periodIds) on the same signal.
   *
   * Idempotent: an already-published report short-circuits to a published
   * outcome without a second write or a duplicate metric bump (defense-in-depth
   * against two ticks racing; the scheduler's candidate query is `status='draft'`
   * so this is rarely reached).
   *
   * Missing sections are NOT auto-stubbed in the DB — they render as "Не сдал"
   * at read time from the head dashboard, keeping the write path narrow.
   */
  async publishAuto(activeReportId: string): Promise<AutoPublishResult> {
    const report = await this.getAssembledReport(activeReportId);

    if (report.status === "published") {
      return { published: true, report };
    }

    this.logger.info("auto-publishing report", { activeReportId });
    const result = await this.repository.saveAutoPublishedReport(
      assembledReportSchema.parse({
        ...report,
        status: "published",
        publishedAt: new Date(),
        publishedById: null,
        publishedByName: "system",
      }),
    );

    if (!result.published) {
      // Compare-and-set matched zero rows: the period was archived (or already
      // published) after candidate selection. Expected no-op — emit no metrics
      // and enqueue no ingestion so a skip is never reported as a publish.
      this.logger.info("auto-publish skipped: archived after selection", {
        activeReportId,
      });
      return { published: false };
    }

    // `state='published'`, same `from='open'` label auto-publish has always
    // used — a scheduler candidate is always `status='draft'` with
    // `periodStatus='open'`, never a reopened period. Emit only after the
    // write succeeds so a failed save never inflates the counter.
    await emitPublishSideEffects(
      {
        telemetry: this.telemetry,
        ingestionHook: this.ingestionHook,
        // publishAuto has never invalidated the analytics cache (no
        // `invalidateAnalyticsCache` collaborator is wired here) — that stays
        // as-is; only `period.publish` does.
        onIngestionError: (error) => {
          this.logger.warn("ingestion hook failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        },
        // A report with zero sections was never enqueued — preserved from
        // the pre-consolidation enqueueIngestion guard.
        skipIngestionWhenEmpty: true,
      },
      {
        priorStatus: "open",
        getSectionIds: () =>
          result.report.sections.map((s) => s.reportSectionId),
      },
    );
    return { published: true, report: result.report };
  }
}
