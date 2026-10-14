import { Inject, Injectable } from "@nestjs/common";
import {
  isWithinReopenWindow,
  type PeriodStatus,
  type UserSession,
} from "@weeklyreport/shared";

import { APP_LOGGER } from "../../../lib/audit-logger.js";
import type { AppLogger } from "../../../lib/logger.js";
import type { PeriodLifecycleExpectation } from "../domain/period-lifecycle-expectation.js";
import {
  PERIOD_TELEMETRY,
  type PeriodTelemetry,
} from "./period-telemetry.port.js";
import { emitPublishSideEffects } from "./publish-side-effects.js";

export class PeriodAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeriodAccessError";
  }
}

// Lifecycle target outside the caller's permitted scope (not the server-derived
// active period, or an archived period) → FORBIDDEN. PeriodAccessError, by contrast,
// carries state/policy failures → BAD_REQUEST.
export class PeriodScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeriodScopeError";
  }
}

// The target `reportId` does not resolve → NOT_FOUND (a bare Error would
// surface as INTERNAL_SERVER_ERROR).
export class PeriodNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeriodNotFoundError";
  }
}

export class PeriodStaleStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeriodStaleStateError";
  }
}

// Outcome of the guarded manual-publish compare-and-set. A zero-row match is
// split by an in-transaction re-read so a concurrent publish ("raced",
// idempotent) never reads as an archive race ("archived", a domain error).
export type PublishPeriodOutcome =
  | { readonly transitioned: true }
  | {
      readonly transitioned: false;
      readonly reason: "raced" | "archived" | "stale";
    };

export interface PeriodRepository {
  getReportById(
    reportId: string,
  ): Promise<(PeriodLifecycleExpectation & { readonly id: string }) | null>;
  // Guarded compare-and-set is bound to the exact lifecycle and reporting
  // envelope authorized by the service, so side effects run once per real
  // transition; PublishPeriodOutcome carries the zero-row classification.
  publishPeriod(
    reportId: string,
    userId: string,
    expected: PeriodLifecycleExpectation,
  ): Promise<PublishPeriodOutcome>;
  reopenPeriod(
    reportId: string,
    expected: PeriodLifecycleExpectation,
    policy: { readonly enforceSingleReopen: boolean },
  ): Promise<void>;
  // Active editable id (publish target) + latest non-archived published id
  // (reopen target), delegated to the weekly-report resolvers so the head's
  // lifecycle target matches its page — one query definition, no second copy.
  getCurrentEditableId(): Promise<string | null>;
  getLatestPublishedNonArchivedId(): Promise<string | null>;
  // Id of an existing reopened, non-archived period, or null. The single-
  // active-reopen guard reads it so a head cannot hold two reopened periods
  // at once (which would let them walk back through history).
  getReopenedNonArchivedId(): Promise<string | null>;
}

// DI token binding the PeriodRepository port to its adapter at the module
// boundary — the service depends on the port, not the concrete prisma class.
export const PERIOD_REPOSITORY = Symbol("PeriodRepository");
export const PERIOD_SETTINGS = Symbol("PeriodSettings");
export const PERIOD_ANALYTICS_CACHE = Symbol("PeriodAnalyticsCache");

// The service only consumes invalidation from the injected cache.
export type AnalyticsCacheInvalidator = () => Promise<void>;

// Settings are read on each reopen so policy edits take effect immediately.
export type ReopenPolicyReader = () => Promise<{
  allowReopenAfterPublish: boolean;
  reopenWindowHours: number;
}>;

// A zero-row compare-and-set is either an archive that landed inside the
// read→write window (fail closed — the pre-write check cannot see it) or a
// concurrent publish that already reached the desired state (idempotent).
function assertPublishRaceIsIdempotent(
  reason: "raced" | "archived" | "stale",
): void {
  if (reason === "archived") {
    throw new PeriodScopeError("Archived periods cannot be published.");
  }
  if (reason === "stale") {
    throw new PeriodStaleStateError(
      "The period changed while it was being published. Reload and retry.",
    );
  }
}

@Injectable()
export class PeriodService {
  private readonly invalidateAnalyticsCache: AnalyticsCacheInvalidator;
  private readonly readReopenPolicy: ReopenPolicyReader;
  private readonly onSideEffectError: (error: unknown) => void;

  constructor(
    @Inject(PERIOD_REPOSITORY)
    private readonly repository: PeriodRepository,
    @Inject(PERIOD_ANALYTICS_CACHE)
    cache: { readonly invalidateAll: AnalyticsCacheInvalidator },
    @Inject(PERIOD_SETTINGS)
    settings: { readonly getSettings: ReopenPolicyReader },
    @Inject(PERIOD_TELEMETRY) private readonly telemetry: PeriodTelemetry,
    @Inject(APP_LOGGER) logger: Pick<AppLogger, "warn">,
  ) {
    this.invalidateAnalyticsCache = () => cache.invalidateAll();
    this.readReopenPolicy = async () => {
      const policy = await settings.getSettings();
      return {
        allowReopenAfterPublish: policy.allowReopenAfterPublish,
        reopenWindowHours: policy.reopenWindowHours,
      };
    };
    this.onSideEffectError = (error) => {
      logger.warn("publish side-effect failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    };
  }

  async publishPeriod(
    reportId: string,
    session: UserSession,
  ): Promise<{ success: true; reportId: string }> {
    const report = await this.repository.getReportById(reportId);

    if (!report) {
      throw new PeriodNotFoundError(`Report ${reportId} not found.`);
    }

    if (report.archived) {
      throw new PeriodScopeError("Archived periods cannot be published.");
    }

    // Idempotent success, mirroring the CAS-loser branch: a retry landing
    // after the winner committed already has the desired state — no error, and
    // no counters or side-effects may run for a redundant publish.
    if (report.periodStatus === "published") {
      return { success: true, reportId };
    }

    await this.assertHeadTargetMatches(
      reportId,
      session,
      this.resolveActiveIdFor(report.periodStatus),
    );

    // Capture prior status before the write so the from-label reflects
    // the actual state (open or reopened), not a hardcoded value.
    const priorStatus = report.periodStatus;

    const outcome = await this.repository.publishPeriod(
      reportId,
      session.userId,
      report,
    );

    if (!outcome.transitioned) {
      // The loser of the race emits no counters and runs no post-publish
      // side-effects, so a redundant publish never inflates the on-time ratio.
      assertPublishRaceIsIdempotent(outcome.reason);
      return { success: true, reportId };
    }

    await emitPublishSideEffects(
      {
        telemetry: this.telemetry,
        invalidateAnalyticsCache: this.invalidateAnalyticsCache,
        onSideEffectError: this.onSideEffectError,
      },
      {
        priorStatus,
      },
    );

    return { success: true, reportId };
  }

  // A reopened target resolves to the ONE period the single-active-reopen guard
  // permits, never the newest editable — otherwise an admin-reopened historical
  // period (a second reopened row) could be republished by a head.
  private resolveActiveIdFor(
    periodStatus: PeriodStatus,
  ): () => Promise<string | null> {
    return periodStatus === "reopened"
      ? () => this.repository.getReopenedNonArchivedId()
      : () => this.repository.getCurrentEditableId();
  }

  // A non-admin head's lifecycle target MUST be the server-derived active
  // period, so a stale or hand-crafted `reportId` fails closed. Admin skips the
  // check — period management legitimately acts on historical/scheduled ids.
  private async assertHeadTargetMatches(
    reportId: string,
    session: UserSession,
    resolveActiveId: () => Promise<string | null>,
  ): Promise<void> {
    if (session.role === "admin") {
      return;
    }
    const activeId = await resolveActiveId();
    if (reportId !== activeId) {
      throw new PeriodScopeError(
        "Only the active period can be published or reopened.",
      );
    }
  }

  // Reopening the latest published period uncovers the next as the new
  // latest-published; this one-at-a-time cap stops a head walking back through
  // history, rewriting snapshots and on-time telemetry. Admin stays exempt.
  private async assertNoConcurrentReopen(session: UserSession): Promise<void> {
    if (session.role === "admin") {
      return;
    }
    const existingReopenedId = await this.repository.getReopenedNonArchivedId();
    if (existingReopenedId) {
      throw new PeriodScopeError(
        "Another period is already reopened. Publish it before reopening another.",
      );
    }
  }

  async reopenPeriod(
    reportId: string,
    session: UserSession,
  ): Promise<{ success: true; reportId: string }> {
    const report = await this.repository.getReportById(reportId);

    if (!report) {
      throw new PeriodNotFoundError(`Report ${reportId} not found.`);
    }

    if (report.archived) {
      throw new PeriodScopeError("Archived periods cannot be reopened.");
    }

    if (report.periodStatus !== "published") {
      throw new PeriodAccessError("Only published periods can be reopened.");
    }

    await this.assertHeadTargetMatches(reportId, session, () =>
      this.repository.getLatestPublishedNonArchivedId(),
    );

    await this.assertNoConcurrentReopen(session);

    const policy = await this.readReopenPolicy();
    if (!policy.allowReopenAfterPublish) {
      throw new PeriodAccessError(
        "Reopening published periods is disabled in Settings (allowReopenAfterPublish=false).",
      );
    }
    if (policy.reopenWindowHours > 0) {
      // openspec/specs/admin-settings-ui/spec.md measures the window from publish;
      // without publishedAt the service cannot establish eligibility.
      if (!report.publishedAt) {
        throw new PeriodAccessError(
          "Published period is missing publishedAt; reopen window cannot be enforced.",
        );
      }
      if (
        !isWithinReopenWindow(
          policy.reopenWindowHours,
          report.publishedAt,
          Date.now(),
        )
      ) {
        throw new PeriodAccessError(
          `Reopen window expired (${policy.reopenWindowHours}h after publication).`,
        );
      }
    }

    await this.repository.reopenPeriod(reportId, report, {
      enforceSingleReopen: session.role !== "admin",
    });
    await this.invalidateAnalyticsCache();

    return { success: true, reportId };
  }
}
