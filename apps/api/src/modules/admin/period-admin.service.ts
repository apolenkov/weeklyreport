import {
  type AdminCreatePeriodManualInput,
  type AdminCreatePeriodManualResult,
  type AdminSnapshot,
  type AdminUpdatePeriodManualInput,
  type AdminUpdatePeriodManualResult,
  type AppSettings,
  adminCreatePeriodManualResultSchema,
  adminCreatePeriodManualSchema,
  adminSnapshotSchema,
  adminUpdatePeriodManualResultSchema,
  adminUpdatePeriodManualSchema,
  appSettingsSchema,
  type PeriodListBucket,
  type PeriodListItem,
  type PeriodState,
  periodListItemSchema,
  type ReportPeriod,
  reportPeriodSchema,
} from "@customreport/shared";

import { computeDeadline } from "../../lib/business-date.js";
import { type AppLogger, createNullLogger } from "../../lib/logger";
import { initialPeriodState } from "../period/period-transition.js";
import {
  AdminAccessError,
  AdminPeriodNotFoundError,
  AdminPeriodOverlapError,
  type AdminRepository,
} from "./admin-shared";

/**
 * Owns the period lifecycle surface: the Admin Periods tab read/archive
 * paths, manual create/update with the overlap gate + grace-period /
 * deadline math, unarchive, and report deletion. Extracted verbatim from
 * `AdminService` (code-quality-modernization, Wave 3); behavior unchanged.
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
    const snapshot = await this.getSnapshot();
    const nextPeriods = snapshot.periods.some(
      (row) => row.id === parsedPeriod.id,
    )
      ? snapshot.periods.map((row) =>
          row.id === parsedPeriod.id ? parsedPeriod : row,
        )
      : [...snapshot.periods, parsedPeriod];

    return this.repository.saveSnapshot(
      adminSnapshotSchema.parse({ ...snapshot, periods: nextPeriods }),
    );
  }

  // -----------------------------------------------------------------
  // UFB-052 (Phase 51-B): Admin Periods tab read/archive surface
  // -----------------------------------------------------------------

  /**
   * Resolve the virtual buckets `'active' | 'archive'` to a concrete
   * set of `PeriodState` values. The active bucket excludes `archived`
   * and `published-out-of-reopen-window` (the published rows that the
   * UI treats as effectively archived even before the auto-archiver
   * runs). The archive bucket is the inverse.
   *
   * Currently both `published` rows are routed to the active bucket;
   * the post-fetch derivation of `canReopen` lets the UI surface the
   * out-of-window rows in the archive section without a second query.
   * If 51-D wants strict server-side bucketing, this is the seam.
   */
  private resolveBucketStates(bucket: PeriodListBucket): PeriodState[] {
    switch (bucket) {
      case "active":
        return ["scheduled", "open", "published"];
      case "archive":
        return ["archived"];
      case "scheduled":
      case "open":
      case "published":
      case "archived":
        return [bucket];
      default: {
        const _exhaustive: never = bucket;
        throw new Error(`Unknown period bucket: ${String(_exhaustive)}`);
      }
    }
  }

  /**
   * UFB-052 (Phase 51-B): paginated period list filtered by lifecycle
   * bucket. Returns rows with server-precomputed `canReopen` (driven
   * by `AppSettings.allowReopenAfterPublish` + `reopenWindowHours`)
   * and `canArchive` so the UI doesn't need to know the policy rules.
   *
   * The hot path uses the `(periodState, periodStart desc)` composite
   * index added in 51-C; submission-progress counts come from a single
   * grouped query against `ReportSection`.
   */
  async listPeriodsByState(input: {
    bucket: PeriodListBucket;
    limit?: number;
  }): Promise<PeriodListItem[]> {
    if (!this.repository.listPeriodsByState) {
      return [];
    }
    const states = this.resolveBucketStates(input.bucket);
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
    const settings = await this.getSettings();
    const rows = await this.repository.listPeriodsByState({
      states,
      limit,
    });

    const now = Date.now();
    return rows.map((row) => {
      const canReopen =
        row.periodState === "published" &&
        settings.allowReopenAfterPublish &&
        row.publishedAt !== null &&
        row.publishedAt.getTime() + settings.reopenWindowHours * 3_600_000 >
          now;
      // Archive is allowed for any not-yet-archived published period;
      // the auto-archiver handles the deferred "weeks-after-publish"
      // path. Manual archive is the head's escape hatch.
      const canArchive = row.periodState === "published" && !row.archived;
      return periodListItemSchema.parse({
        id: row.id,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        deadline: row.deadline,
        publishedAt: row.publishedAt,
        periodState: row.periodState,
        periodStatus: row.periodStatus,
        archived: row.archived,
        autoPublished: row.autoPublished,
        autoArchived: row.autoArchived,
        submittedCount: row.submittedCount,
        totalCount: row.totalCount,
        weekLabel: row.weekLabel,
        canReopen,
        canArchive,
      });
    });
  }

  /**
   * UFB-052 (Phase 51-B): manual archive — flips both the legacy
   * `archived` boolean and the new `periodState` enum to `'archived'`
   * in a single write so the two-state-machine invariant from 51-C
   * (Open Question 1) is preserved.
   */
  async archivePeriod(periodId: string): Promise<{ success: true }> {
    if (!this.repository.archivePeriod) {
      throw new Error(
        "AdminRepository.archivePeriod is not implemented for this repository.",
      );
    }
    this.logger.info("archived period", { periodId });
    await this.repository.archivePeriod(periodId);
    return { success: true };
  }

  /**
   * UFB-063: admin escape hatch that mints a Period without waiting for
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
   * The initial `periodState` is derived via `initialPeriodState` — same
   * rule the scheduler uses (`'scheduled'` when start is in the future,
   * `'open'` otherwise). The scheduler skips PolicyApplicator on create
   * (pre-existing gap, see SUMMARY); we mirror that exactly so the two
   * creation paths stay behaviourally identical and a future fix lands
   * in one place.
   */
  async createPeriodManual(
    rawInput: AdminCreatePeriodManualInput,
    options: { now?: Date } = {},
  ): Promise<AdminCreatePeriodManualResult> {
    if (!this.repository.createPeriodManual) {
      throw new Error(
        "AdminRepository.createPeriodManual is not implemented for this repository.",
      );
    }
    const input = adminCreatePeriodManualSchema.parse(rawInput);
    const settings = await this.getSettings();
    const now = options.now ?? new Date();

    // -- Defaults -------------------------------------------------------
    // periodEnd defaults to (periodStart + periodLengthDays - 1) at the
    // very end of that day (23:59:59.999 UTC). The manual path accepts
    // any calendar start day; the scheduler remains the only Monday-anchored
    // creator.
    const periodEnd =
      input.periodEnd ??
      new Date(
        input.periodStart.getTime() +
          (settings.periodLengthDays - 1) * 24 * 3_600_000 +
          (24 * 3_600_000 - 1),
      );

    if (periodEnd.getTime() < input.periodStart.getTime()) {
      throw new AdminPeriodOverlapError(
        `periodEnd (${periodEnd.toISOString()}) is before periodStart (${input.periodStart.toISOString()}).`,
      );
    }

    // deadlineTime is "HH:MM"; computeDeadline takes an hour integer. We
    // strip minutes (the scheduler already does — its hardcoded `18`
    // matches the default "18:00"). When future plans add sub-hour
    // granularity, both this call site and the scheduler should be
    // updated together.
    const [hourStr] = settings.deadlineTime.split(":");
    const deadlineHour = Number(hourStr ?? "18");

    const deadline =
      input.deadline ??
      computeDeadline(
        input.periodStart,
        settings.defaultDeadlineDays,
        settings.workingDays,
        settings.defaultTimezone,
        deadlineHour,
      );

    // -- Overlap gate ---------------------------------------------------
    if (this.repository.findOverlappingPeriod) {
      const conflict = await this.repository.findOverlappingPeriod({
        periodStart: input.periodStart,
        periodEnd,
      });
      if (conflict) {
        throw new AdminPeriodOverlapError(
          `A period already exists for these dates: ${conflict.periodStart
            .toISOString()
            .slice(0, 10)}…${conflict.periodEnd.toISOString().slice(0, 10)}.`,
        );
      }
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

    const created = await this.repository.createPeriodManual({
      periodStart: input.periodStart,
      periodEnd,
      deadline,
      weekLabel,
      periodState,
    });

    return adminCreatePeriodManualResultSchema.parse({
      periodId: created.id,
      periodStart: created.periodStart,
      periodEnd: created.periodEnd,
      deadline: created.deadline,
      periodState: created.periodState,
    });
  }

  /**
   * UFB-067: patch an existing Report's date envelope + weekLabel. Mirror
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
    diff: Partial<{
      periodStart: { from: Date; to: Date };
      periodEnd: { from: Date; to: Date };
      deadline: { from: Date; to: Date };
      weekLabel: { from: string | null; to: string | null };
    }>;
  }> {
    if (
      !this.repository.updatePeriodManual ||
      !this.repository.readPeriodById
    ) {
      throw new Error(
        "AdminRepository.updatePeriodManual / readPeriodById is not implemented for this repository.",
      );
    }
    const input = adminUpdatePeriodManualSchema.parse(rawInput);

    // -- Read existing -------------------------------------------------
    const existing = await this.repository.readPeriodById(input.reportId);
    if (!existing) {
      throw new AdminPeriodNotFoundError(`Period ${input.reportId} not found.`);
    }

    // -- Compute the actual diff ---------------------------------------
    // Build a `data` payload that contains ONLY the keys whose new value
    // actually differs from the current row. Equal-value writes are
    // dropped so the audit envelope only carries real changes (matches
    // the no-op contract in the docstring above).
    const data: {
      periodStart?: Date;
      periodEnd?: Date;
      deadline?: Date;
      weekLabel?: string | null;
    } = {};
    const diff: Partial<{
      periodStart: { from: Date; to: Date };
      periodEnd: { from: Date; to: Date };
      deadline: { from: Date; to: Date };
      weekLabel: { from: string | null; to: string | null };
    }> = {};

    if (
      input.periodStart !== undefined &&
      input.periodStart.getTime() !== existing.periodStart.getTime()
    ) {
      data.periodStart = input.periodStart;
      diff.periodStart = { from: existing.periodStart, to: input.periodStart };
    }
    if (
      input.periodEnd !== undefined &&
      input.periodEnd.getTime() !== existing.periodEnd.getTime()
    ) {
      data.periodEnd = input.periodEnd;
      diff.periodEnd = { from: existing.periodEnd, to: input.periodEnd };
    }
    if (
      input.deadline !== undefined &&
      input.deadline.getTime() !== existing.deadline.getTime()
    ) {
      data.deadline = input.deadline;
      diff.deadline = { from: existing.deadline, to: input.deadline };
    }
    // weekLabel: explicit `null` is an allowed value (clear). Compare on
    // structural equality (`null === null`, `'foo' === 'foo'`) so an
    // unchanged-label PATCH is dropped from the diff.
    if (
      input.weekLabel !== undefined &&
      input.weekLabel !== existing.weekLabel
    ) {
      data.weekLabel = input.weekLabel;
      diff.weekLabel = { from: existing.weekLabel, to: input.weekLabel };
    }

    // -- No-op short-circuit -------------------------------------------
    if (Object.keys(data).length === 0) {
      // Return the existing row unchanged so the web layer's cache echo
      // stays consistent with a real edit. Diff is empty → router skips
      // the audit envelope.
      return {
        result: adminUpdatePeriodManualResultSchema.parse({
          periodId: existing.id,
          periodStart: existing.periodStart,
          periodEnd: existing.periodEnd,
          deadline: existing.deadline,
          periodState: existing.periodState,
          weekLabel: existing.weekLabel,
        }),
        diff,
      };
    }

    // -- Overlap gate (only when an envelope key changed) --------------
    const envelopeChanged =
      data.periodStart !== undefined || data.periodEnd !== undefined;
    if (envelopeChanged && this.repository.findOverlappingPeriod) {
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
        throw new AdminPeriodOverlapError(
          `A period already exists for these dates: ${conflict.periodStart
            .toISOString()
            .slice(0, 10)}…${conflict.periodEnd.toISOString().slice(0, 10)}.`,
        );
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

    return {
      result: adminUpdatePeriodManualResultSchema.parse({
        periodId: updated.id,
        periodStart: updated.periodStart,
        periodEnd: updated.periodEnd,
        deadline: updated.deadline,
        periodState: updated.periodState,
        weekLabel: updated.weekLabel,
      }),
      diff,
    };
  }

  /**
   * UFB-052 (Phase 51-B): un-archive — reverts `archived=false` and
   * derives the next `periodState` from the legacy tuple at write time
   * (since the new state column lost the pre-archive distinction
   * scheduled/open/published when it was set to `'archived'`). The
   * repository is the only layer that has access to the historical
   * tuple, so the derivation lives there.
   */
  async unarchivePeriod(
    periodId: string,
  ): Promise<{ success: true; periodState: PeriodState }> {
    if (!this.repository.unarchivePeriod) {
      throw new Error(
        "AdminRepository.unarchivePeriod is not implemented for this repository.",
      );
    }
    this.logger.info("unarchived period", { periodId });
    const result = await this.repository.unarchivePeriod(periodId);
    return { success: true, periodState: result.nextPeriodState };
  }

  /**
   * A27: delete a period (Report row) and cascade-delete all child rows.
   * Guard: cannot delete published periods. Throws `AdminAccessError` if the
   * period is published; maps to FORBIDDEN via trpc.error-mapper.
   */
  async deleteReport(reportId: string): Promise<{ success: true }> {
    if (!this.repository.deleteReport) {
      throw new Error(
        "AdminRepository.deleteReport is not implemented for this repository.",
      );
    }
    const report = await this.repository.readReportForDelete?.(reportId);
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
