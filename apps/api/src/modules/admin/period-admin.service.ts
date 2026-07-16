import {
  type AdminCreatePeriodManualInput,
  type AdminCreatePeriodManualResult,
  adminCreatePeriodManualResultSchema,
  adminCreatePeriodManualSchema,
  type AdminSnapshot,
  adminSnapshotSchema,
  type AdminUpdatePeriodManualInput,
  type AdminUpdatePeriodManualResult,
  adminUpdatePeriodManualSchema,
  type AppSettings,
  appSettingsSchema,
  type PeriodListBucket,
  type PeriodListItem,
  type PeriodState,
  type ReportPeriod,
  reportPeriodSchema,
} from "@customreport/shared";

import { computeDeadline } from "../../lib/business-date.js";
import { type AppLogger, createNullLogger } from "../../lib/logger";
import { initialPeriodState } from "../period/index.js";
import {
  AdminAccessError,
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
  type AdminRepository,
} from "./admin-shared";
import {
  assertEnvelopeEditable,
  computePeriodPatch,
  deadlineHourFromSetting,
  defaultPeriodEnd,
  overlapMessage,
  type PeriodPatchDiff,
  resolveBucketStates,
  toPeriodListItem,
  toUpdateManualResult,
} from "./period-admin.envelope.js";

const DEFAULT_PERIOD_LIST_LIMIT = 50;
const MAX_PERIOD_LIST_LIMIT = 200;

/**
 * Owns the period lifecycle surface: the Admin Periods tab read/archive
 * paths, manual create/update with the overlap gate + grace-period /
 * deadline math, unarchive, and report deletion.
 */
export class PeriodAdminService {
  private readonly logger: AppLogger;

  constructor(
    private readonly repository: AdminRepository,
    logger?: AppLogger,
  ) {
    this.logger = logger ?? createNullLogger();
  }

  private async getSettings(): Promise<AppSettings> {
    return appSettingsSchema.parse(await this.repository.getSettings());
  }

  private async getSnapshot(): Promise<AdminSnapshot> {
    return adminSnapshotSchema.parse(await this.repository.getSnapshot());
  }

  async upsertPeriod(period: ReportPeriod): Promise<AdminSnapshot> {
    const parsedPeriod = reportPeriodSchema.parse(period);
    // Targeted write: a single-period edit touches only this Report and never
    // re-writes stale T0 copies of groups/users/projects/rules. A newly-created
    // period still triggers the post-commit applicator inside the repository.
    this.logger.info("upserted period", { periodId: parsedPeriod.id });
    await this.repository.upsertPeriod(parsedPeriod);
    return this.getSnapshot();
  }

  // -----------------------------------------------------------------
  // Admin Periods tab read/archive surface
  // -----------------------------------------------------------------

  /**
   * Paginated period list filtered by lifecycle bucket. Returns rows with
   * server-precomputed `canReopen` / `canArchive` (see `toPeriodListItem`) so
   * the UI doesn't need to know the policy rules. The hot path uses the
   * `(periodState, periodStart desc)` composite index; submission-progress
   * counts come from a single grouped query against `ReportSection`.
   */
  async listPeriodsByState(input: {
    bucket: PeriodListBucket;
    limit?: number;
  }): Promise<PeriodListItem[]> {
    const limit = Math.min(
      Math.max(input.limit ?? DEFAULT_PERIOD_LIST_LIMIT, 1),
      MAX_PERIOD_LIST_LIMIT,
    );
    const settings = await this.getSettings();
    const rows = await this.repository.listPeriodsByState({
      states: resolveBucketStates(input.bucket),
      limit,
    });

    const now = Date.now();
    return rows.map((row) => toPeriodListItem(row, settings, now));
  }

  /**
   * Manual archive — flips both the legacy `archived` boolean and the new
   * `periodState` enum to `'archived'` in a single guarded write so the
   * two-state-machine invariant is preserved. The repository's compare-and-set
   * fails closed on a concurrent writer: an already-archived period surfaces its
   * `AdminPeriodAlreadyArchivedError` (→ CONFLICT) here rather than a silent
   * success, so a reopen racing the archive is mutually exclusive from this side.
   */
  async archivePeriod(periodId: string): Promise<{ success: true }> {
    this.logger.info("archived period", { periodId });
    await this.repository.archivePeriod(periodId);
    return { success: true };
  }

  /**
   * Admin escape hatch that mints a Period without waiting for
   * the daily `PeriodCreatorScheduler` (00:05 UTC cron). Targets fresh
   * dev/staging DBs (zero Reports → admin is blocked) and one-off
   * backfill cycles.
   *
   * Defaulting rules (mirrors the scheduler's date math):
   *   - `periodEnd` defaults to `periodStart + (settings.periodLengthDays - 1)`
   *     calendar days at end-of-day (23:59:59.999) so a 7-day period
   *     spans seven inclusive calendar dates from any chosen start day.
   *   - `deadline` defaults to `computeDeadline(periodStart, settings.defaultDeadlineDays,
   *     settings.workingDays, settings.defaultTimezone, hourFromDeadlineTime)`.
   *
   * Validation:
   *   - `periodEnd >= periodStart` (after applying default).
   *   - `findOverlappingPeriod` is consulted BEFORE the create to surface
   *     a friendly error pointing at the blocking row (admin-visible date
   *     range, not just "already exists").
   *
   * The initial `periodState` is derived via `initialPeriodState` — the same
   * rule the scheduler uses (`'scheduled'` when start is in the future,
   * `'open'` otherwise). Reminder rules for the new period are materialised by
   * the repository's post-create applicator hook
   * (`AdminPrismaRepository.createPeriodManual`), the same way `saveSnapshot`
   * handles snapshot-created periods — so every admin/scheduler creation path
   * now produces a period WITH its reminder rules (the scheduler routes
   * through `period-factory`, which also applies them).
   */
  async createPeriodManual(
    rawInput: AdminCreatePeriodManualInput,
    options: { now?: Date } = {},
  ): Promise<AdminCreatePeriodManualResult> {
    const input = adminCreatePeriodManualSchema.parse(rawInput);
    const settings = await this.getSettings();
    const now = options.now ?? new Date();

    // -- Defaults -------------------------------------------------------
    // The manual path accepts any calendar start day; the scheduler remains
    // the only Monday-anchored creator.
    const periodEnd =
      input.periodEnd ??
      defaultPeriodEnd(input.periodStart, settings.periodLengthDays);

    if (periodEnd.getTime() < input.periodStart.getTime()) {
      throw new AdminPeriodOverlapError(
        `periodEnd (${periodEnd.toISOString()}) is before periodStart (${input.periodStart.toISOString()}).`,
      );
    }

    const deadline =
      input.deadline ??
      computeDeadline(
        input.periodStart,
        settings.defaultDeadlineDays,
        settings.workingDays,
        settings.defaultTimezone,
        deadlineHourFromSetting(settings.deadlineTime),
      );

    // -- Overlap gate ---------------------------------------------------
    const conflict = await this.repository.findOverlappingPeriod({
      periodStart: input.periodStart,
      periodEnd,
    });
    if (conflict) {
      throw new AdminPeriodOverlapError(overlapMessage(conflict));
    }

    // -- Mint -----------------------------------------------------------
    const periodState = initialPeriodState(input.periodStart, now);
    const weekLabel = input.weekLabel ?? null;

    this.logger.info("creating period manually", {
      periodStart: input.periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      deadline: deadline.toISOString(),
      periodState,
    });

    const created = await this.repository.createPeriodManual(
      {
        periodStart: input.periodStart,
        periodEnd,
        deadline,
        weekLabel,
        periodState,
      },
      // Forward `now` so the applicator drops reminders already elapsed for a
      // backfilled (past-dated) period instead of arming them to fire stale.
      now,
    );

    return adminCreatePeriodManualResultSchema.parse({
      periodId: created.id,
      periodStart: created.periodStart,
      periodEnd: created.periodEnd,
      deadline: created.deadline,
      periodState: created.periodState,
    });
  }

  /**
   * Patch an existing Report's date envelope + weekLabel. Mirror
   * of `createPeriodManual` for the in-place edit flow exposed in the
   * Admin → Periods table (each row now carries an inline Edit icon that
   * opens the same dialog in "edit" mode).
   *
   * Semantics:
   *   - Only fields present in `rawInput` are written. Omitting a key
   *     leaves the column untouched (true PATCH).
   *   - `weekLabel: null` is an explicit clear; omitting the key means
   *     "leave as-is" — the zod schema's `.nullable().optional()` keeps
   *     the two cases distinguishable on the wire.
   *   - When the envelope shifts, the overlap gate is re-run with
   *     `excludeId === reportId` so the row being edited cannot
   *     self-conflict with its own original envelope.
   *   - The current row is read once up front; missing → throws
   *     `AdminPeriodNotFoundError` (maps to NOT_FOUND).
   *   - No-op edit (zero data keys) short-circuits before the overlap gate
   *     and skips the audit envelope — there is nothing to audit (the
   *     `from === to` diff would be empty and SIEM rules that key on a
   *     non-empty changed-fields list would otherwise log noise).
   *
   * Returns the canonical updated row + an audit-diff hint so the router
   * can emit `period.manual-edit` with the actual delta. The diff list
   * stays inside the service return value (vs being computed in the
   * router) because the service is the only layer that has both the
   * before and after envelopes in scope at the same time.
   */
  async updatePeriodManual(rawInput: AdminUpdatePeriodManualInput): Promise<{
    result: AdminUpdatePeriodManualResult;
    /**
     * Per-field `(before, after)` snapshots of changed columns. Empty
     * object means the input was a no-op (zero data keys or all values
     * matched the existing row); the router treats an empty diff as
     * "skip audit envelope".
     */
    diff: PeriodPatchDiff;
  }> {
    const input = adminUpdatePeriodManualSchema.parse(rawInput);

    // -- Read existing -------------------------------------------------
    const existing = await this.repository.readPeriodById(input.reportId);
    if (!existing) {
      throw new AdminPeriodNotFoundError(`Period ${input.reportId} not found.`);
    }

    // -- Compute the actual diff ---------------------------------------
    // `data` carries ONLY the keys whose new value differs from the current
    // row; equal-value writes are dropped so the audit envelope reflects the
    // no-op contract in the docstring above.
    const { data, diff } = computePeriodPatch(existing, input);

    // -- No-op short-circuit -------------------------------------------
    if (Object.keys(data).length === 0) {
      // Return the existing row unchanged so the web layer's cache echo
      // stays consistent with a real edit. Diff is empty → router skips
      // the audit envelope.
      return { result: toUpdateManualResult(existing), diff };
    }

    assertEnvelopeEditable(existing.periodState, data);

    // -- Overlap gate (only when an envelope key changed) --------------
    const envelopeChanged =
      data.periodStart !== undefined || data.periodEnd !== undefined;
    if (envelopeChanged) {
      // Use the new effective envelope (incoming where provided, existing
      // otherwise) so the overlap check matches what will be written.
      const effectiveStart = data.periodStart ?? existing.periodStart;
      const effectiveEnd = data.periodEnd ?? existing.periodEnd;
      if (effectiveEnd.getTime() < effectiveStart.getTime()) {
        throw new AdminPeriodOverlapError(
          `periodEnd (${effectiveEnd.toISOString()}) is before periodStart (${effectiveStart.toISOString()}).`,
        );
      }
      const conflict = await this.repository.findOverlappingPeriod({
        periodStart: effectiveStart,
        periodEnd: effectiveEnd,
        excludeId: input.reportId,
      });
      if (conflict) {
        throw new AdminPeriodOverlapError(overlapMessage(conflict));
      }
    }

    this.logger.info("updating period manually", {
      periodId: input.reportId,
      changedFields: Object.keys(data),
    });

    const updated = await this.repository.updatePeriodManual({
      reportId: input.reportId,
      data,
    });

    return { result: toUpdateManualResult(updated), diff };
  }

  /**
   * Un-archive — reverts `archived=false` and
   * derives the next `periodState` from the legacy tuple at write time
   * (since the new state column lost the pre-archive distinction
   * scheduled/open/published when it was set to `'archived'`). The
   * repository is the only layer that has access to the historical
   * tuple, so the derivation lives there.
   */
  async unarchivePeriod(
    periodId: string,
  ): Promise<{ success: true; periodState: PeriodState }> {
    this.logger.info("unarchived period", { periodId });
    const result = await this.repository.unarchivePeriod(periodId);
    return { success: true, periodState: result.nextPeriodState };
  }

  /**
   * Delete a period (Report row) and cascade-delete all child rows.
   * Guard: cannot delete published periods. Throws `AdminAccessError` if the
   * period is published; maps to FORBIDDEN via trpc.error-mapper.
   */
  async deleteReport(reportId: string): Promise<{ success: true }> {
    const report = await this.repository.readReportForDelete(reportId);
    if (!report) {
      throw new AdminAccessError(`Report ${reportId} not found.`);
    }
    if (report.status === "published" || report.periodStatus === "published") {
      throw new AdminAccessError(
        "Cannot delete a published period. Reopen it first if needed.",
      );
    }
    this.logger.info("deleted report", { reportId });
    await this.repository.deleteReport(reportId);
    return { success: true };
  }
}
