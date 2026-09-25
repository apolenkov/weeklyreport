import {
  type AssembledReport,
  assembledReportSchema,
  type ReportSectionReadModel,
} from "@customreport/shared";

import type { AppLogger } from "../../../lib/logger";
import { emitPublishSideEffects } from "../../period/index.js";
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
  // Compare-and-set: writes only while the row is still in the coherent
  // editable lifecycle and its deadline matches the overdue scheduler scan.
  // A zero-row match writes nothing and returns `{ published: false }`.
  // `expectedDeadline` is part of the compare-and-set identity.
  saveAutoPublishedReport(
    report: AssembledReport,
    expectedDeadline: Date | null,
  ): Promise<AutoPublishResult>;
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

    // portfolioOverview passes through unchanged: the snapshot builder already
    // folds each distinct product once — recounting per (section, project)
    // occurrence would double-count products shared between leads.
    return assembledReportSchema.parse({
      ...report,
      sections: sortedSections,
    });
  }

  // Scheduler-driven: no human actor, so `publishedById=null`. A head who
  // published the same report between candidate selection and this call lands
  // on `wasAlreadyPublished: true` — never counted as auto in audit trails.
  async publishAuto(
    activeReportId: string,
    publishAt: Date,
    expectedDeadline?: Date | null,
  ): Promise<AutoPublishResult> {
    const report = await this.getAssembledReport(activeReportId);

    if (report.status === "published") {
      return { published: true, report, wasAlreadyPublished: true };
    }

    this.logger.info("auto-publishing report", { activeReportId });
    const result = await this.repository.saveAutoPublishedReport(
      deriveAutoPublishedReport(report, publishAt),
      expectedDeadline === undefined ? report.deadline : expectedDeadline,
    );

    if (!result.published) {
      // The repository did not publish the candidate; skip publication effects.
      this.logger.info("auto-publish skipped: candidate no longer eligible", {
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
        invalidateAnalyticsCache: this.invalidateAnalyticsCache,
        onSideEffectError: (error) => {
          this.logger.warn("publish side-effect failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        },
      },
      {
        priorStatus: "open",
      },
    );
    return {
      published: true,
      report: result.report,
      wasAlreadyPublished: result.wasAlreadyPublished,
    };
  }
}
