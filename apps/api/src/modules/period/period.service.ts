import { MS_PER_HOUR, type UserSession } from "@customreport/shared";

import {
  customreportPeriodStateTransitionsTotal,
  customreportReportsSubmittedTotal,
} from "../../infrastructure/metrics/metrics.registry.js";

export class PeriodAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeriodAccessError";
  }
}

/**
 * A period-lifecycle target is out of scope for the caller: a head acting on a
 * report that is not the server-derived active period, or any role acting on an
 * archived period. Mapped to FORBIDDEN. Distinct from `PeriodAccessError`, which
 * keeps carrying the (unmapped) state/policy failures — already-published,
 * non-published reopen, and the reopen-window gates.
 */
export class PeriodScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeriodScopeError";
  }
}

/**
 * The target `reportId` does not resolve to a report. Mapped to NOT_FOUND; a
 * bare `Error` would otherwise surface as INTERNAL_SERVER_ERROR.
 */
export class PeriodNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeriodNotFoundError";
  }
}

/**
 * Outcome of the guarded manual-publish compare-and-set. A real transition
 * carries `transitioned: true`; a zero-row match is split by an in-transaction
 * re-read so the service can tell a concurrent publish (`reason: "raced"` —
 * idempotent success) from an archive landing inside the read→write window
 * (`reason: "archived"` — a domain error). The contradictory archived-and-
 * published row is never written.
 */
export type PublishPeriodOutcome =
  | { readonly transitioned: true }
  | { readonly transitioned: false; readonly reason: "raced" | "archived" };

export interface PeriodRepository {
  getReportById(reportId: string): Promise<{
    id: string;
    status: string;
    periodStatus: string;
    publishedAt: Date | null;
    archived: boolean;
  } | null>;
  /**
   * Publish a period via a guarded compare-and-set keyed on
   * `periodStatus != "published" AND archived = false`. A zero-row match is
   * disambiguated by an in-transaction re-read: `reason: "raced"` (a concurrent
   * publish won) vs `reason: "archived"` (the period was archived inside the
   * read→write window), so the caller emits telemetry and runs ingestion at
   * most once per transition and fails closed on an archive race.
   */
  publishPeriod(
    reportId: string,
    userId: string,
  ): Promise<PublishPeriodOutcome>;
  reopenPeriod(reportId: string): Promise<void>;
  /**
   * The current active editable period id (the `period.publish` target) and the
   * latest non-archived published period id (the `period.reopen` target). Both
   * delegate to the weekly-report repository's resolver queries so the head's
   * lifecycle target matches the `reportId` its weekly-report page resolves —
   * one query definition, no second copy.
   */
  getCurrentEditableId(): Promise<string | null>;
  getLatestPublishedNonArchivedId(): Promise<string | null>;
  /**
   * The id of an existing reopened, non-archived period, or null. Read by the
   * single-active-reopen guard so a non-admin head cannot hold two reopened
   * periods at once (which would let them walk back through history).
   */
  getReopenedNonArchivedId(): Promise<string | null>;
  /**
   * List of section ids tied to a report — read by the post-publish
   * ingestion seam (see {@link IngestionPublishHook}) so a future async
   * consumer can enqueue per-section work after a period publishes.
   */
  listSectionIds(reportId: string): Promise<string[]>;
}

/**
 * The cache invalidation port. PeriodService stays Redis-free; the
 * AnalyticsCache is wired through this lambda by period.module.ts.
 */
export type AnalyticsCacheInvalidator = () => Promise<void>;

/**
 * A lazy reader for the two reopen-policy knobs in `AppSettings`.
 * PeriodService stays decoupled from AdminService by reading them through
 * this lambda; the production wiring resolves to `appSettings.get`. The
 * return is non-null: a reopen-policy gate is always wired, so no code path
 * can construct the service without one.
 */
export type ReopenPolicyReader = () => Promise<{
  allowReopenAfterPublish: boolean;
  reopenWindowHours: number;
}>;

/**
 * Fire-and-forget post-publish ingestion seam, called after a
 * successful `publishPeriod` with the just-published section ids.
 * Defaults to a no-op so existing tests (88+) that don't care about
 * ingestion stay green. Errors are swallowed by the caller so a
 * downstream consumer blip cannot fail a real-user publish action.
 *
 * The original AI/RAG consumer was removed; the seam is kept so a rebuilt
 * pipeline — or any other async consumer — can re-wire without
 * touching the publish path.
 */
export type IngestionPublishHook = (
  sectionIds: readonly string[],
) => Promise<void>;

export class PeriodService {
  constructor(
    private readonly repository: PeriodRepository,
    private readonly invalidateAnalyticsCache: AnalyticsCacheInvalidator,
    // Reopen-policy gate reader. Required — production wiring is done in
    // period.module.ts; the gate is always enforced.
    private readonly readReopenPolicy: ReopenPolicyReader,
    /**
     * On every successful publishPeriod, called with the section ids of
     * the just-published period. No-op by default; production may wire a
     * real ingestion consumer here (see {@link IngestionPublishHook}).
     */
    private readonly ingestionHook: IngestionPublishHook = () =>
      Promise.resolve(undefined),
  ) {}

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

    if (report.periodStatus === "published") {
      throw new PeriodAccessError("Period is already published.");
    }

    // A head publishes either the current editable period (steady state) or the
    // single active reopened period. getCurrentEditableId resolves the newest
    // editable by periodStart — the *open* next period when a reopened older
    // period coexists — so a reopened target is checked against
    // getReopenedNonArchivedId instead, the one period the single-active-reopen
    // guard permits. Asserting that equality (rather than skipping the check for
    // any reopened target) closes the bypass where an admin-reopened historical
    // period — a second reopened row — could be republished by a head.
    const resolveActiveId =
      report.periodStatus === "reopened"
        ? () => this.repository.getReopenedNonArchivedId()
        : () => this.repository.getCurrentEditableId();
    await this.assertHeadTargetMatches(reportId, session, resolveActiveId);

    // Capture prior status before the write so the from-label reflects
    // the actual state (open or reopened), not a hardcoded value.
    const priorStatus = report.periodStatus;

    const outcome = await this.repository.publishPeriod(
      reportId,
      session.userId,
    );

    if (!outcome.transitioned) {
      // The guarded compare-and-set matched zero rows for one of two reasons.
      // An archive landed inside the read→write window (the pre-write
      // `report.archived` check above cannot catch this): fail closed with the
      // same domain error. Otherwise a concurrent publish won — idempotent
      // success that emits no counters and runs no post-publish side-effects so
      // a redundant publish never inflates the on-time-ratio numerator.
      if (outcome.reason === "archived") {
        throw new PeriodScopeError("Archived periods cannot be published.");
      }
      return { success: true, reportId };
    }

    await this.emitPublishSideEffects(reportId, priorStatus);

    return { success: true, reportId };
  }

  /**
   * Post-transition side-effects, emitted only after a real transition so a
   * redundant or failed write never inflates the counters (mirrors the
   * discipline in publication.service.ts). The ingestion enqueue reads the
   * section ids AFTER the publish transaction so sections that raced into the
   * period before commit are still picked up; its errors never bubble — a
   * downstream consumer blip must not turn a successful publish into a 5xx.
   */
  private async emitPublishSideEffects(
    reportId: string,
    priorStatus: string,
  ): Promise<void> {
    customreportReportsSubmittedTotal.inc({ state: "published" });
    customreportPeriodStateTransitionsTotal.inc({
      from: priorStatus,
      to: "published",
    });

    await this.invalidateAnalyticsCache();

    try {
      const sectionIds = await this.repository.listSectionIds(reportId);
      await this.ingestionHook(sectionIds);
    } catch {
      // intentionally swallowed
    }
  }

  /**
   * For a non-admin head the lifecycle target MUST be the server-derived active
   * period; a stale or hand-crafted `reportId` fails closed. Admin may target
   * any non-archived report (the period-management UI legitimately acts on
   * historical/scheduled ids), so it skips the equality check.
   */
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

  /**
   * A non-admin head may hold at most one reopened period at a time. Without
   * this, a head could walk back through history: reopening the latest published
   * period uncovers the next as the new latest-published, which is then
   * reopenable, and each could be republished — rewriting historical snapshots
   * and on-time telemetry, the exact threat this change closes. Admin (the
   * recovery path) is exempt and may reopen arbitrarily.
   */
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

    // Reopen-policy enforcement, always applied. Two gates:
    //   1. `allowReopenAfterPublish` master switch — if false, no reopen
    //      is ever allowed regardless of window.
    //   2. `reopenWindowHours` — if set to N>0, the reopen must arrive
    //      within `publishedAt + N * 1h`. `publishedAt` is always
    //      populated for periodStatus='published' rows (the publishPeriod
    //      writer sets it atomically), but we still guard against a NULL
    //      defensively so a hand-corrected DB row cannot crash the gate.
    const policy = await this.readReopenPolicy();
    if (!policy.allowReopenAfterPublish) {
      throw new PeriodAccessError(
        "Reopening published periods is disabled in Settings (allowReopenAfterPublish=false).",
      );
    }
    if (policy.reopenWindowHours > 0 && report.publishedAt) {
      const windowEnd =
        report.publishedAt.getTime() + policy.reopenWindowHours * MS_PER_HOUR;
      if (Date.now() > windowEnd) {
        throw new PeriodAccessError(
          `Reopen window expired (${policy.reopenWindowHours}h after publication).`,
        );
      }
    }

    await this.repository.reopenPeriod(reportId);
    await this.invalidateAnalyticsCache();

    return { success: true, reportId };
  }
}
