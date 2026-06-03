import type { UserSession } from "@customreport/shared";

export class PeriodAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeriodAccessError";
  }
}

export interface PeriodRepository {
  getReportById(reportId: string): Promise<{
    id: string;
    status: string;
    periodStatus: string;
    publishedAt: Date | null;
  } | null>;
  publishPeriod(reportId: string, userId: string): Promise<void>;
  reopenPeriod(reportId: string): Promise<void>;
  /**
   * List of section ids tied to a report — read by the post-publish
   * ingestion seam (see {@link IngestionPublishHook}) so a future async
   * consumer can enqueue per-section work after a period publishes.
   * Optional on the port so existing unit-test fixtures that don't care
   * about ingestion stay green; the production repo implements it.
   */
  listSectionIds?(reportId: string): Promise<string[]>;
}

/**
 * Phase 30-01 (ANAL-01): the cache invalidation port. PeriodService stays
 * Redis-free; the AnalyticsCache is wired through this lambda by
 * period.module.ts. Default no-op keeps existing unit tests green.
 */
export type AnalyticsCacheInvalidator = () => Promise<void>;

/**
 * UFB-052 (Phase 51-B): a lazy reader for the two reopen-policy knobs
 * in `AppSettings`. PeriodService stays decoupled from AdminService
 * by reading them through this lambda; tests can stub the values
 * directly, and the production wiring resolves to `appSettings.get`.
 *
 * `null` means "no settings wired" — backwards-compatible no-op gate
 * (every reopen is allowed), so existing unit tests that did not pass
 * a reader keep passing without modification.
 */
export type ReopenPolicyReader = () => Promise<{
  allowReopenAfterPublish: boolean;
  reopenWindowHours: number;
} | null>;

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
    private readonly invalidateAnalyticsCache: AnalyticsCacheInvalidator = () =>
      Promise.resolve(undefined),
    /**
     * UFB-052 (Phase 51-B): reopen-policy gate. Defaults to a null
     * reader (no gating) so the 88+ unit/integration tests that pre-date
     * 51-B keep passing — when no reader is wired, every reopen is
     * allowed exactly as before. Production wiring is done in
     * period.module.ts.
     */
    private readonly readReopenPolicy: ReopenPolicyReader = () =>
      Promise.resolve(null),
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
      throw new Error(`Report ${reportId} not found.`);
    }

    if (report.periodStatus === "published") {
      throw new PeriodAccessError("Period is already published.");
    }

    await this.repository.publishPeriod(reportId, session.userId);
    await this.invalidateAnalyticsCache();

    // Fire-and-forget post-publish ingestion enqueue. Read the section
    // ids AFTER the publish transaction so any sections that raced into
    // the period before commit are still picked up. Errors never bubble —
    // a downstream consumer blip must not turn a successful publish into
    // a 5xx.
    if (this.repository.listSectionIds) {
      try {
        const sectionIds = await this.repository.listSectionIds(reportId);
        await this.ingestionHook(sectionIds);
      } catch {
        // intentionally swallowed
      }
    }

    return { success: true, reportId };
  }

  async reopenPeriod(
    reportId: string,
  ): Promise<{ success: true; reportId: string }> {
    const report = await this.repository.getReportById(reportId);

    if (!report) {
      throw new Error(`Report ${reportId} not found.`);
    }

    if (report.periodStatus !== "published") {
      throw new PeriodAccessError("Only published periods can be reopened.");
    }

    // UFB-052 (Phase 51-B): reopen-policy enforcement. Two gates:
    //   1. `allowReopenAfterPublish` master switch — if false, no reopen
    //      is ever allowed regardless of window.
    //   2. `reopenWindowHours` — if set to N>0, the reopen must arrive
    //      within `publishedAt + N * 1h`. `publishedAt` is always
    //      populated for periodStatus='published' rows (the publishPeriod
    //      writer sets it atomically), but we still guard against a NULL
    //      defensively so a hand-corrected DB row cannot crash the gate.
    //
    // When no policy reader is wired (legacy tests), gating is skipped
    // entirely so old fixtures keep passing.
    const policy = await this.readReopenPolicy();
    if (policy) {
      if (!policy.allowReopenAfterPublish) {
        throw new PeriodAccessError(
          "Reopening published periods is disabled in Settings (allowReopenAfterPublish=false).",
        );
      }
      if (policy.reopenWindowHours > 0 && report.publishedAt) {
        const windowEnd =
          report.publishedAt.getTime() + policy.reopenWindowHours * 3_600_000;
        if (Date.now() > windowEnd) {
          throw new PeriodAccessError(
            `Reopen window expired (${policy.reopenWindowHours}h after publication).`,
          );
        }
      }
    }

    await this.repository.reopenPeriod(reportId);
    await this.invalidateAnalyticsCache();

    return { success: true, reportId };
  }
}
