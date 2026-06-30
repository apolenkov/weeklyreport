import {
  type AssembledReport,
  assembledReportSchema,
  type DraftSavePayload,
  draftSaveSchema,
  type PortfolioOverview,
  type ReportSectionReadModel,
  type UserSession,
} from "@customreport/shared";

import {
  customreportPeriodStateTransitionsTotal,
  customreportReportsSubmittedTotal,
} from "../../infrastructure/metrics/metrics.registry.js";
import { type AppLogger, createNullLogger } from "../../lib/logger";

/**
 * Fire-and-forget post-publish ingestion seam. Unit tests default to a
 * no-op so the 200+ existing tests stay green. Errors thrown by the port
 * are swallowed by the publish path — the publish must succeed even when
 * a downstream consumer is degraded.
 *
 * The original AI/RAG consumer was removed; the seam is kept so a rebuilt
 * pipeline — or any other async consumer — can re-wire without touching
 * the publish path.
 */
export type IngestionPublishHook = (
  sectionIds: readonly string[],
) => Promise<void>;

export class PublicationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicationAccessError";
  }
}

/**
 * Thrown by `getAssembledReport` when the requested report row is absent. A
 * missing resource, so the tRPC error-mapper renders it NOT_FOUND (distinct
 * from `PublicationAccessError` → CONFLICT). Its three in-service callers
 * (`publishReport`, `publishAuto`, `updateSectionForReview`) propagate it, so a
 * missing report surfaces as NOT_FOUND instead of a false 500.
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
   * Persist the assembled report through the manual `publish` (head-driven) or
   * `open` (draft save) transition. The auto path does NOT route here — it uses
   * {@link saveAutoPublishedReport} so the compare-and-set write guard cannot be
   * bypassed.
   */
  saveAssembledReport(report: AssembledReport): Promise<AssembledReport>;
  /**
   * Persist a scheduler-driven auto-publish via the `autoPublish` transition,
   * guarded by a compare-and-set that only writes when the target row is still
   * `status="draft"` and `archived=false`. A zero-row match (the period was
   * archived or already published after candidate selection) writes nothing and
   * returns `{ published: false }`.
   */
  saveAutoPublishedReport(report: AssembledReport): Promise<AutoPublishResult>;
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
    private readonly ingestionHook: IngestionPublishHook = () =>
      Promise.resolve(undefined),
  ) {
    this.logger = logger ?? createNullLogger();
  }

  /**
   * Private helper — invokes the post-publish ingestion hook with every
   * section id in the assembled report and swallows any error so the
   * calling publish path always returns the report.
   */
  private async enqueueIngestion(report: AssembledReport): Promise<void> {
    const ids = report.sections.map((s) => s.reportSectionId);
    if (ids.length === 0) return;
    try {
      await this.ingestionHook(ids);
    } catch (error) {
      this.logger.warn("ingestion hook failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
   * Scheduler-driven auto-publish. Same effect as {@link publishReport} but no
   * human actor — `publishedById=null` and `publishedByName='system'`.
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

    // Same telemetry as publishReport, same `state` label so ops aggregate
    // without `or` predicates — the manual-vs-auto split is recovered from the
    // period_state_transitions panel paired with publishedById nullness. Emit
    // only after the write succeeds so a failed save never inflates the counter.
    customreportReportsSubmittedTotal.inc({ state: "published" });
    customreportPeriodStateTransitionsTotal.inc({
      from: "open",
      to: "published",
    });
    // Fire-and-forget ingestion enqueue AFTER metrics — auto-publishes feed the
    // same queue as manual publishes, and ingestion must never block telemetry.
    await this.enqueueIngestion(result.report);
    return { published: true, report: result.report };
  }
}
